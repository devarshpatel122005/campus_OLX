from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import os

app = Flask(__name__)
CORS(app)

# Load model and label encoder
script_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(script_dir, 'model.pkl')
encoder_path = os.path.join(script_dir, 'label_encoder.pkl')

try:
    model = joblib.load(model_path)
    label_encoder = joblib.load(encoder_path)
    print("✅ Model and encoder loaded successfully")
except Exception as e:
    print(f"❌ Error loading model: {e}")
    print("⚠️  Please run train_model.py first to generate the model files.")
    model = None
    label_encoder = None

@app.route('/', methods=['GET'])
def home():
    """Health check endpoint"""
    return jsonify({
        'status': 'running',
        'service': 'CampusOLX AI Price Prediction',
        'model_loaded': model is not None
    })

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict resale price for a product.
    
    Expected JSON input:
    {
        "original_price": 5000,
        "age": 12,
        "condition": 4,
        "category": "electronics"
    }
    """
    try:
        if model is None:
            return jsonify({
                'error': 'Model not loaded. Please run train_model.py first.'
            }), 500
        
        # Get request data
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['original_price', 'age', 'condition', 'category']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'error': f'Missing required field: {field}'
                }), 400
        
        # Extract features
        original_price = float(data['original_price'])
        age_months = int(data['age'])
        condition = int(data['condition'])
        category = data['category'].lower()
        
        # Validate ranges
        if original_price <= 0:
            return jsonify({'error': 'original_price must be positive'}), 400
        
        if age_months < 0:
            return jsonify({'error': 'age must be non-negative'}), 400
        
        if condition < 1 or condition > 5:
            return jsonify({'error': 'condition must be between 1 and 5'}), 400
        
        # Encode category
        valid_categories = ['electronics', 'books', 'furniture', 'clothing', 'sports', 'other']
        if category not in valid_categories:
            category = 'other'
        
        category_encoded = label_encoder.transform([category])[0]
        
        # Prepare features for prediction
        features = np.array([[original_price, age_months, condition, category_encoded]])
        
        # Make prediction
        predicted_price = model.predict(features)[0]
        
        # Round to 2 decimal places
        predicted_price = round(predicted_price, 2)
        
        # Ensure predicted price is not higher than original price
        predicted_price = min(predicted_price, original_price)
        
        # Ensure minimum price
        predicted_price = max(predicted_price, 10)
        
        return jsonify({
            'predicted_price': predicted_price,
            'input': {
                'original_price': original_price,
                'age_months': age_months,
                'condition': condition,
                'category': category
            }
        })
    
    except Exception as e:
        return jsonify({
            'error': f'Prediction failed: {str(e)}'
        }), 500

@app.route('/categories', methods=['GET'])
def get_categories():
    """Get list of valid categories"""
    return jsonify({
        'categories': ['electronics', 'books', 'furniture', 'clothing', 'sports', 'other']
    })

if __name__ == '__main__':
    print("=" * 60)
    print("🤖 CampusOLX AI Service")
    print("=" * 60)
    print("📡 Starting Flask server on http://localhost:5000")
    print("🔍 Available endpoints:")
    print("  GET  /          - Health check")
    print("  POST /predict   - Price prediction")
    print("  GET  /categories - Valid categories")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=True)
