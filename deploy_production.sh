#!/bin/bash

# Multi-RAG Production Deployment Script
# Usage: ./deploy_production.sh or bash deploy_production.sh

set -e  # Exit on error

echo "🚀 Starting Multi-RAG Production Deployment"
echo "============================================"

# Variables
DROPLET_IP="168.144.83.17"
APP_DIR="/root/app"
DB_NAME="resume_rag_db"
DB_USER="postgres"

# Check if running locally or on droplet
if [ "$1" == "remote" ]; then
    echo "📍 Deploying to remote droplet: $DROPLET_IP"
    
    # SSH and run deployment
    ssh root@$DROPLET_IP << 'EOF'
        echo "📍 Connected to droplet"
        cd /root/app
        
        echo "📥 Pulling latest code from git..."
        git pull origin main
        
        echo "🗄️ Running database migration..."
        psql -d resume_rag_db -U postgres -f add_rag_model_preference_migration.sql
        
        echo "🔄 Restarting backend service..."
        docker-compose down
        docker-compose up -d
        
        echo "⏳ Waiting for backend to start..."
        sleep 5
        
        echo "✅ Verifying backend is online..."
        if curl -s http://localhost:3001/docs > /dev/null; then
            echo "✅ Backend is responding"
        else
            echo "❌ Backend not responding. Check logs:"
            docker-compose logs search_api --tail 20
            exit 1
        fi
EOF
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ DEPLOYMENT SUCCESSFUL!"
        echo "============================================"
        echo "Backend is live at: http://resumerag.kanugulabharathkumar.me"
        echo ""
        echo "Test all models:"
        echo "  Model 1: curl -X POST http://localhost:3001/search_candidates -H 'Authorization: Bearer <token>' -d '{\"query\": \"python\", \"rag_model\": 1}'"
        echo "  Model 2: curl -X POST http://localhost:3001/search_candidates -H 'Authorization: Bearer <token>' -d '{\"query\": \"python django\", \"rag_model\": 2}'"
        echo "  Model 3: curl -X POST http://localhost:3001/search_candidates -H 'Authorization: Bearer <token>' -d '{\"query\": \"senior engineer\", \"rag_model\": 3}'"
    else
        echo "❌ DEPLOYMENT FAILED. Check logs on droplet."
        exit 1
    fi

elif [ "$1" == "local" ]; then
    echo "📍 Deploying to local machine"
    
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ docker-compose not found. Install Docker Desktop first."
        exit 1
    fi
    
    echo "🐳 Starting Docker containers..."
    docker-compose up -d
    
    echo "⏳ Waiting for containers to start..."
    sleep 3
    
    echo "🗄️ Running database migration..."
    docker-compose exec db psql -U postgres -d resume_rag_db -f /app/add_rag_model_preference_migration.sql
    
    echo "🔄 Restarting backend..."
    docker-compose restart search_api
    
    echo "⏳ Waiting for backend to start..."
    sleep 3
    
    echo "✅ Local deployment complete!"
    echo "============================================"
    echo "Backend: http://localhost:3001/docs"
    echo "pgAdmin: http://localhost:5050"
    echo ""
    echo "Test: curl http://localhost:3001/health"
    
else
    echo "Usage: ./deploy_production.sh [remote|local]"
    echo ""
    echo "Examples:"
    echo "  ./deploy_production.sh remote  - Deploy to DigitalOcean droplet"
    echo "  ./deploy_production.sh local   - Deploy locally with Docker"
    exit 1
fi
