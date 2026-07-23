#!/usr/bin/env python3
"""
Migration script to add rag_model_preference column to user_preferences table
This adds support for storing user's RAG model preference (1=Dense, 2=Hybrid, 3=HyDE)
"""

import os
from sqlalchemy import text
from dotenv import load_dotenv
from database import engine

load_dotenv()

def migrate():
    """Execute migration to add rag_model_preference column"""
    with engine.connect() as connection:
        # Check if column already exists
        result = connection.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='user_preferences' AND column_name='rag_model_preference'
        """))
        
        if result.fetchone():
            print("✓ rag_model_preference column already exists")
            return
        
        # Add the column
        connection.execute(text("""
            ALTER TABLE user_preferences
            ADD COLUMN rag_model_preference INTEGER DEFAULT 1
            CHECK (rag_model_preference IN (1, 2, 3))
        """))
        connection.commit()
        print("✓ Successfully added rag_model_preference column")
        
        # Create index for performance
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_user_preferences_rag_model 
            ON user_preferences(user_id, rag_model_preference)
        """))
        connection.commit()
        print("✓ Created index on rag_model_preference")

if __name__ == "__main__":
    try:
        migrate()
        print("✓ Migration completed successfully")
    except Exception as e:
        print(f"✗ Migration failed: {str(e)}")
        exit(1)
