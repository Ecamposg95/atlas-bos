
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine, Base
from app.security import get_password_hash
from app.models.users import User, Role
from app.models.organization import Branch

def seed_safe():
    print("🌱 Seeding Users safely (without deleting DB)...")
    db = SessionLocal()
    try:
        # Check Branch
        branch = db.query(Branch).first()
        if not branch:
            print("Creating default branch...")
            branch = Branch(name="Sucursal Matriz", address="Stress Test Addr", phone="555-0000")
            db.add(branch)
            db.commit()
            db.refresh(branch)

        # Check Admin
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            print("Creating admin user...")
            admin = User(
                username="admin", 
                password_hash=get_password_hash("123"),
                full_name="Admin User",
                role=Role.ADMINISTRADOR,
                branch_id=branch.id,
                is_active=True
            )
            db.add(admin)
            db.commit()
            print("✅ Admin created.")
        else:
            print("ℹ️ Admin already exists.")
            # Reset password to be sure
            admin.password_hash = get_password_hash("123")
            db.commit()
            print("🔄 Admin password reset to '123'.")

    except Exception as e:
        print(f"❌ Error seeding: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_safe()
