import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import joblib
import os

def generate_synthetic_data(n_samples=1000):
    """
    Generate synthetic product resale data.
    Formula: Resale Price = Original Price * (0.95 ^ Age_Months) * condition_factor
    """
    np.random.seed(42)
    
    # Product categories
    categories = ['electronics', 'books', 'furniture', 'clothing', 'sports', 'other']
    
    # Generate data
    data = {
        'original_price': np.random.uniform(100, 10000, n_samples),
        'age_months': np.random.randint(0, 48, n_samples),
        'condition': np.random.randint(1, 6, n_samples),  # 1-5 scale
        'category': np.random.choice(categories, n_samples)
    }
    
    df = pd.DataFrame(data)
    
    # Calculate resale price using depreciation formula
    # Price = Original * (0.95 ^ Age_Months) * condition_factor
    # Condition factor: 1=0.5, 2=0.65, 3=0.8, 4=0.9, 5=1.0
    condition_factors = {1: 0.5, 2: 0.65, 3: 0.8, 4: 0.9, 5: 1.0}
    df['condition_factor'] = df['condition'].map(condition_factors)
    
    # Apply depreciation formula
    df['resale_price'] = df['original_price'] * (0.95 ** df['age_months']) * df['condition_factor']
    
    # Add some random noise (±5%)
    noise = np.random.uniform(0.95, 1.05, n_samples)
    df['resale_price'] = df['resale_price'] * noise
    
    # Ensure resale price is not negative or zero
    df['resale_price'] = df['resale_price'].clip(lower=10)
    
    return df

def train_model():
    """
    Train a Random Forest model on synthetic data.
    """
    print("🔄 Generating synthetic data...")
    df = generate_synthetic_data(n_samples=1000)
    
    print(f"✅ Generated {len(df)} samples")
    print(f"📊 Sample data:\n{df.head()}\n")
    
    # Prepare features
    le = LabelEncoder()
    df['category_encoded'] = le.fit_transform(df['category'])
    
    # Features and target
    X = df[['original_price', 'age_months', 'condition', 'category_encoded']]
    y = df['resale_price']
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Train Random Forest
    print("🤖 Training Random Forest model...")
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    train_score = model.score(X_train, y_train)
    test_score = model.score(X_test, y_test)
    
    print(f"✅ Model trained successfully!")
    print(f"📈 Training R² Score: {train_score:.4f}")
    print(f"📊 Testing R² Score: {test_score:.4f}")
    
    # Save model and label encoder
    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(script_dir, 'model.pkl')
    encoder_path = os.path.join(script_dir, 'label_encoder.pkl')
    
    joblib.dump(model, model_path)
    joblib.dump(le, encoder_path)
    
    print(f"💾 Model saved to: {model_path}")
    print(f"💾 Label encoder saved to: {encoder_path}")
    
    # Show feature importances
    feature_names = ['original_price', 'age_months', 'condition', 'category']
    importances = model.feature_importances_
    
    print("\n🎯 Feature Importances:")
    for name, importance in zip(feature_names, importances):
        print(f"  {name}: {importance:.4f}")

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 CampusOLX AI - Model Training Script")
    print("=" * 60)
    train_model()
    print("\n✅ Training complete! You can now run app.py to start the API server.")
