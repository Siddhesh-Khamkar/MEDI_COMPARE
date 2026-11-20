from pathlib import Path

import joblib
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


# Project मधील CSV file शोधा
BASE_DIR = Path(__file__).resolve().parents[2]
CSV_PATH = BASE_DIR / "data" / "medicine_data_project.csv"

# Trained model इथे save होईल
MODEL_DIR = BASE_DIR / "BACKEND" / "ml_models"
MODEL_PATH = MODEL_DIR / "medicine_price_model.joblib"

print("Loading medicine dataset...")

df = pd.read_csv(
    CSV_PATH,
    usecols=[
        "sub_category",
        "product_name",
        "salt_composition",
        "product_price",
        "product_manufactured",
    ],
    dtype=str,
)

# ₹, commas आणि spaces काढून किंमत number मध्ये बदला
df["product_price"] = pd.to_numeric(
    df["product_price"]
    .str.replace(r"[₹,\s]", "", regex=True),
    errors="coerce",
)

# आवश्यक माहिती नसलेल्या किंवा चुकीच्या किमतीच्या rows काढा
df = df.dropna(
    subset=[
        "product_name",
        "salt_composition",
        "product_price",
    ]
)

# रिकाम्या text fields हाताळा
text_columns = [
    "product_name",
    "salt_composition",
    "sub_category",
    "product_manufactured",
]

for column in text_columns:
    df[column] = df[column].fillna("").str.strip()

# अत्यंत कमी किंवा शून्य किंमतीच्या नोंदी काढा
df = df[df["product_price"] > 0].copy()

if len(df) < 20:
    raise ValueError(
        "Training साठी पुरेशा valid price records मिळाल्या नाहीत."
    )

X = df[
    [
        "product_name",
        "salt_composition",
        "sub_category",
        "product_manufactured",
    ]
]

y = df["product_price"]

# नाव आणि salt मधील शब्दांना numerical features मध्ये बदला
preprocessor = ColumnTransformer(
    transformers=[
        (
            "medicine_name",
            TfidfVectorizer(
                max_features=50000,
                ngram_range=(1, 2),
            ),
            "product_name",
        ),
        (
            "salt",
            TfidfVectorizer(
                max_features=20000,
                ngram_range=(1, 2),
            ),
            "salt_composition",
        ),
        (
            "categories",
            OneHotEncoder(handle_unknown="ignore"),
            ["sub_category", "product_manufactured"],
        ),
    ]
)

model = Pipeline(
    steps=[
        ("features", preprocessor),
        ("regressor", Ridge(alpha=2.0)),
    ]
)

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
)

print(f"Training records: {len(X_train)}")
print(f"Testing records: {len(X_test)}")
print("Training ML model...")

model.fit(X_train, y_train)

predictions = model.predict(X_test)

mae = mean_absolute_error(y_test, predictions)

print(f"Mean Absolute Error: ₹{mae:.2f}")

MODEL_DIR.mkdir(parents=True, exist_ok=True)
joblib.dump(model, MODEL_PATH)

print("Model training completed!")
print(f"Saved model to: {MODEL_PATH}")