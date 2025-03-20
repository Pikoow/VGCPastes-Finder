import requests
import json

# Define the URL and payload
url = "http://127.0.0.1:5000/generate"
payload = {"instruction": "I want a team with a strong attacker and a Poison type Pokémon."}

# Send the POST request
response = requests.post(url, json=payload)

# Check if the request was successful
if response.status_code == 200:
    # Save the response content to output.json
    with open("output.json", "w", encoding="utf-8") as f:
        json.dump(response.json(), f, indent=4)
    print("Response saved to output.json")
else:
    print(f"Error: {response.status_code} - {response.text}")