"""
Create user_preferences table using SQLAlchemy
Run this after adding UserPreference model to models.py
"""
from database import engine
from models import Base, UserPreference

def create_user_preferences_table():
    """Create only the user_preferences table"""
    print("Creating user_preferences table...")
    
    try:
        # Create only the UserPreference table
        UserPreference.__table__.create(engine, checkfirst=True)
        print("✅ user_preferences table created successfully!")
        
        # Verify table was created
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        if 'user_preferences' in tables:
            print("✅ Table verified in database")
            
            # Show columns
            columns = inspector.get_columns('user_preferences')
            print("\nTable structure:")
            for col in columns:
                print(f"  - {col['name']}: {col['type']}")
        else:
            print("❌ Table not found in database")
            
    except Exception as e:
        print(f"❌ Error creating table: {e}")
        raise

if __name__ == "__main__":
    create_user_preferences_table()
