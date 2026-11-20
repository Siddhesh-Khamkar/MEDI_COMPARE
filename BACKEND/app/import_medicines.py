
import csv
import re
from pathlib import Path
from decimal import Decimal, InvalidOperation

from sqlalchemy import text

from app.db.session import SessionLocal
from app.models import Medicine


CSV_PATH = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "medicine_data_project.csv"
)

BATCH_SIZE = 1000


def parse_price(value):
    if not value:
        return None

    # Remove currency symbols and commas, retaining digits and decimal point.
    cleaned = re.sub(r"[^0-9.]", "", value.strip())

    if not cleaned:
        return None

    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def main():
    if not CSV_PATH.exists():
        print(f"CSV file not found: {CSV_PATH}")
        return

    session = SessionLocal()
    batch = []
    imported = 0

    try:
        # Avoid importing the same dataset twice.
        existing = session.execute(
            text("SELECT COUNT(*) FROM medicines")
        ).scalar_one()

        if existing > 0:
            print(
                f"The medicines table already contains {existing} rows. "
                "Import cancelled to avoid duplicate records."
            )
            return

        with CSV_PATH.open(
            "r", encoding="utf-8-sig", newline=""
        ) as csvfile:
            reader = csv.DictReader(csvfile)

            required_columns = {
                "sub_category",
                "product_name",
                "salt_composition",
                "product_price",
                "product_manufactured",
                "medicine_desc",
                "side_effects",
                "drug_interactions",
            }

            if not reader.fieldnames or not required_columns.issubset(
                set(reader.fieldnames)
            ):
                print("CSV columns do not match the expected dataset.")
                print("Found columns:", reader.fieldnames)
                return

            for row in reader:
                name = (row.get("product_name") or "").strip()

                if not name:
                    continue

                batch.append(
                    Medicine(
                        sub_category=row.get("sub_category") or None,
                        product_name=name,
                        salt_composition=row.get("salt_composition") or None,
                        product_price=parse_price(
                            row.get("product_price") or ""
                        ),
                        product_manufactured=(
                            row.get("product_manufactured") or None
                        ),
                        medicine_desc=row.get("medicine_desc") or None,
                        side_effects=row.get("side_effects") or None,
                        drug_interactions=(
                            row.get("drug_interactions") or None
                        ),
                    )
                )

                if len(batch) >= BATCH_SIZE:
                    session.add_all(batch)
                    session.commit()
                    imported += len(batch)
                    batch.clear()
                    print(f"Imported {imported} medicines...")

            if batch:
                session.add_all(batch)
                session.commit()
                imported += len(batch)

        print(f"Import complete! Total medicines imported: {imported}")

    except Exception as exc:
        session.rollback()
        print("Import failed:", exc)
        raise

    finally:
        session.close()


if __name__ == "__main__":
    main()
