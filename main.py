import os
from pymilvus import connections, Collection, FieldSchema, CollectionSchema, DataType, utility
from dotenv import load_dotenv

load_dotenv()

def initialize_connections():
    """
    Connect to Milvus and create collection if not exists
    """
    # Connect to Milvus
    connections.connect(
        "default",
        host=os.getenv("MILVUS_HOST", "localhost"),
        port=os.getenv("MILVUS_PORT", "19530")
    )
    print("✅ Connected to Milvus!")

    collection_name = os.getenv("MILVUS_COLLECTION_NAME", "hybrid_search006")

    if not utility.has_collection(collection_name):
        fields = [
            FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
            FieldSchema(name="user_id", dtype=DataType.INT64),
            FieldSchema(name="name", dtype=DataType.VARCHAR, max_length=255),
            FieldSchema(name="email", dtype=DataType.VARCHAR, max_length=255),
            FieldSchema(name="phone", dtype=DataType.VARCHAR, max_length=50),
            FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=1536),
            FieldSchema(name="full_resume_text", dtype=DataType.VARCHAR, max_length=65535),
            FieldSchema(name="summary", dtype=DataType.VARCHAR, max_length=65535),
            FieldSchema(name="is_active", dtype=DataType.INT64),
        ]

        schema = CollectionSchema(
            fields=fields,
            description="Resume embeddings for candidate search"
        )

        collection = Collection(
            name=collection_name,
            schema=schema
        )

        # Create index for vector search
        collection.create_index(
            field_name="embedding",
            index_params={
                "metric_type": "COSINE",
                "index_type": "IVF_FLAT",
                "params": {"nlist": 128}
            }
        )
        print(f"✅ Collection '{collection_name}' created!")
    else:
        print(f"✅ Collection '{collection_name}' already exists!")


