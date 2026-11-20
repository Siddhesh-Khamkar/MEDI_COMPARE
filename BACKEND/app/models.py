
from sqlalchemy import Column, Integer, String, DateTime, Text, Numeric, func
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )


class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    sub_category = Column(String(255), nullable=True)
    product_name = Column(Text, nullable=False, index=True)
    salt_composition = Column(Text, nullable=True)
    product_price = Column(Numeric(10, 2), nullable=True)
    product_manufactured = Column(Text, nullable=True)
    medicine_desc = Column(Text, nullable=True)
    side_effects = Column(Text, nullable=True)
    drug_interactions = Column(Text, nullable=True)
