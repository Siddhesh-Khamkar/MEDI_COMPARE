
from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.db.session import test_connection, engine
from app.db.dependencies import get_db
from app.models import Base, User, Medicine
from app.schemas import SignupRequest, LoginRequest, UserResponse
from app.security import hash_password, verify_password
from fastapi.middleware.cors import CORSMiddleware

from pathlib import Path

import joblib
import pandas as pd

from pydantic import BaseModel, Field

class PricePredictionRequest(BaseModel):
    product_name: str = Field(min_length=1, max_length=300)
    salt_composition: str = Field(min_length=1, max_length=500)
    sub_category: str = Field(default="", max_length=200)
    product_manufactured: str = Field(default="", max_length=200)


app = FastAPI(
    title="MedCompare API",
    description="Medicine price comparison platform",
    version="1.0.0"
)

# Load the trained AI price prediction model
BACKEND_DIR = Path(__file__).resolve().parents[1]

MODEL_PATH = (
    BACKEND_DIR
    / "ml_models"
    / "medicine_price_model.joblib"
)

if not MODEL_PATH.exists():
    raise RuntimeError(
        f"Trained model file not found: {MODEL_PATH}"
    )

price_model = joblib.load(MODEL_PATH)

print("AI medicine price prediction model loaded successfully.")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Create database tables
Base.metadata.create_all(bind=engine)


@app.get("/")
def home():
    return {"message": "MedCompare API is running!"}


@app.get("/db-test")
def database_test():
    try:
        version = test_connection()
        return {
            "status": "success",
            "message": "PostgreSQL connected successfully",
            "database_version": version
        }
    except Exception:
        return {
            "status": "error",
            "message": "Could not connect to PostgreSQL"
        }


@app.post("/auth/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    # Check whether this email is already registered
    existing_user = db.query(User).filter(User.email == data.email).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists."
        )

    # Hash the password before storing it
    new_user = User(
        name=data.name.strip(),
        email=str(data.email).lower(),
        password_hash=hash_password(data.password)
    )

    db.add(new_user)
    try:
        db.commit()
        db.refresh(new_user)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create the account."
        )

    return new_user


@app.post("/auth/login", response_model=UserResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    email = str(data.email).lower()

    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    return user


@app.get("/medicines/search")
def search_medicines(
    q: str,
    db: Session = Depends(get_db),
    limit: int = 20
):
    q = q.strip()

    if not q:
        raise HTTPException(
            status_code=400,
            detail="Please enter a medicine name to search."
        )

    # Limit results to a maximum of 50.
    limit = max(1, min(limit, 50))
    search_term = f"%{q}%"

    medicines = (
        db.query(Medicine)
        .filter(
            or_(
                Medicine.product_name.ilike(search_term),
                Medicine.salt_composition.ilike(search_term)
            )
        )
        .order_by(Medicine.product_name)
        .limit(limit)
        .all()
    )

    return {
        "count": len(medicines),
        "results": [
            {
                "id": medicine.id,
                "product_name": medicine.product_name,
                "salt_composition": medicine.salt_composition,
                "product_price": (
                    float(medicine.product_price)
                    if medicine.product_price is not None
                    else None
                ),
                "product_manufactured": medicine.product_manufactured,
                "sub_category": medicine.sub_category,
                "medicine_desc": medicine.medicine_desc,
                "side_effects": medicine.side_effects,
                "drug_interactions": medicine.drug_interactions
            }
            for medicine in medicines
        ]
    }


@app.post("/ai/predict-price")
def predict_medicine_price(data: PricePredictionRequest):
    try:
        # Create input with exactly the same columns used in training
        input_data = pd.DataFrame(
            [
                {
                    "product_name": data.product_name.strip(),
                    "salt_composition": data.salt_composition.strip(),
                    "sub_category": data.sub_category.strip(),
                    "product_manufactured": (
                        data.product_manufactured.strip()
                    ),
                }
            ]
        )

        # Predict price using the trained ML model
        prediction = float(price_model.predict(input_data)[0])

        # Medicine prices should not be negative
        estimated_price = round(max(0.0, prediction), 2)

        return {
            "success": True,
            "product_name": data.product_name,
            "estimated_price": estimated_price,
            "currency": "INR",
            "message": (
                "AI-generated estimate based on the training dataset. "
                "This is not a verified current market price."
            ),
        }

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not predict the medicine price.",
        )

    
from sqlalchemy import or_


@app.get("/medicines/compare")
def compare_medicine_prices(
    q: str,
    db: Session = Depends(get_db),
    limit: int = 20,
):
    q = q.strip()

    if not q:
        raise HTTPException(
            status_code=400,
            detail="Please enter a medicine name or salt composition.",
        )

    limit = max(1, min(limit, 50))
    search_term = f"%{q}%"

    medicines = (
        db.query(Medicine)
        .filter(
            or_(
                Medicine.salt_composition.ilike(search_term),
                Medicine.product_name.ilike(search_term),
            )
        )
        .filter(Medicine.product_price.isnot(None))
        .order_by(Medicine.product_price.asc())
        .limit(limit)
        .all()
    )

    results = [
        {
            "id": medicine.id,
            "product_name": medicine.product_name,
            "salt_composition": medicine.salt_composition,
            "price": float(medicine.product_price),
            "manufacturer": medicine.product_manufactured,
            "sub_category": medicine.sub_category,
        }
        for medicine in medicines
    ]

    return {
        "success": True,
        "query": q,
        "count": len(results),
        "results": results,
        "cheapest_option": results[0] if results else None,
        "message": (
            "Prices are taken from the stored dataset. "
            "Check strength, dosage form, pack size and suitability "
            "with a pharmacist before choosing an alternative."
        ),
    }
