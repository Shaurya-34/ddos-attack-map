import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics import classification_report, accuracy_score
import joblib
import os

# Load dataset
df = pd.read_csv(r"F:\ddos-map\data\merged_ips.csv")

print(df.head())
print("Shape:", df.shape)
print("Columns:", df.columns.tolist())
print(df['label'].value_counts())

# Features & labels
X = df.drop(columns=["ipAddress", "label"])
y = df["label"]

# One-hot encode country codes (use sparse_output if sklearn >= 1.2, else sparse=False)
encoder = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
X_encoded = encoder.fit_transform(X[["countryCode"]])

# Replace original countryCode with encoded
X_final = pd.DataFrame(X_encoded, columns=encoder.get_feature_names_out(["countryCode"]))
X_final["abuseConfidenceScore"] = X["abuseConfidenceScore"].values

# Split dataset
X_train, X_test, y_train, y_test = train_test_split(
    X_final, y, test_size=0.2, random_state=42, stratify=y
)

# Train model
model = RandomForestClassifier(n_estimators=200, random_state=42)
model.fit(X_train, y_train)

# Predictions
y_pred = model.predict(X_test)

# Evaluation
print("\nModel Evaluation:")
print("Accuracy:", accuracy_score(y_test, y_pred))
print(classification_report(y_test, y_pred))

# Ensure backend/models folder exists
os.makedirs(r"F:\ddos-map\backend\models", exist_ok=True)

# Save trained model and encoder
joblib.dump(model, r"F:\ddos-map\backend\models\ip_classifier.joblib")
joblib.dump(encoder, r"F:\ddos-map\backend\models\country_encoder.joblib")

print("\n✅ Model & Encoder saved to F:\\ddos-map\\backend\\models\\")
