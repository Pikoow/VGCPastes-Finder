import pickle
import json

# Load the TF-IDF model
with open("models/recommender.pkl", "rb") as f:
    vectorizer = pickle.load(f)

# Convert the model to a JSON-compatible format
tfidf_model = {
    "vocabulary_": vectorizer.vocabulary_,
    "idf_": vectorizer.idf_.tolist(),
    "stop_words_": list(vectorizer.stop_words_) if vectorizer.stop_words else [],
}

# Save the model as JSON
with open("models/recommender.json", "w") as f:
    json.dump(tfidf_model, f)