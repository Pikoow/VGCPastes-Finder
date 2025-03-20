// Light/Dark Mode Toggle
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");

themeToggle.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    const isDarkMode = document.documentElement.classList.contains("dark");
    localStorage.theme = isDarkMode ? "dark" : "light";
    themeIcon.textContent = isDarkMode ? "☀️" : "🌙";
});

// Search Functionality
document.getElementById("search-btn").addEventListener("click", async () => {
    const instruction = document.getElementById("instruction").value;
    if (!instruction) return;

    // Clear previous team and copy button
    const teamContainer = document.getElementById("team-container");
    const copyContainer = document.getElementById("copy-container");
    teamContainer.innerHTML = "";
    copyContainer.classList.add("hidden");

    // Show loading spinner
    const searchText = document.getElementById("search-text");
    const loadingSpinner = document.getElementById("loading-spinner");
    searchText.textContent = "Searching...";
    loadingSpinner.classList.remove("hidden");

    // Send request to serverless function
    try {
        const response = await fetch("/api/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ instruction }),
        });

        if (!response.ok) {
            throw new Error("Failed to generate team");
        }

        const data = await response.json();

        // Display the team
        data.pokemons.forEach(pokemon => {
            const pokemonCard = `
                <div class="pokemon-card p-3 rounded-lg shadow-md bg-white dark:bg-gray-800">
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Left Side: Image, Name, Item -->
                        <div class="flex flex-col items-center">
                            <img src="https://img.pokemondb.net/sprites/home/normal/${pokemon.name.toLowerCase().replace(/ /g, '-')}.png" alt="${pokemon.name}" class="w-16 h-16 mb-2">
                            <h3 class="font-bold text-sm text-center">${pokemon.name}</h3>
                            <div class="flex items-center mt-1">
                                ${pokemon.item ? `
                                    <img src="https://img.pokemondb.net/sprites/items/${pokemon.item.toLowerCase().replace(/ /g, '-')}.png" alt="${pokemon.item}" class="w-4 h-4 mr-1" onerror="this.style.display='none'">
                                ` : ''}
                                <p class="text-xs text-gray-600 dark:text-gray-400">${pokemon.item || "No Item"}</p>
                            </div>
                        </div>
                        <!-- Right Side: Tera Type and Moves -->
                        <div class="flex flex-col">
                            <p class="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                <span class="font-semibold">Tera Type:</span> ${pokemon.tera_type}
                            </p>
                            <ul class="text-xs text-gray-500 dark:text-gray-300">
                                ${pokemon.moves.map(move => `<li>${move}</li>`).join("")}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
            teamContainer.innerHTML += pokemonCard;
        });

        // Show copy button
        copyContainer.classList.remove("hidden");
        document.getElementById("copy-btn").addEventListener("click", () => {
            const teamText = data.pokemons.map(pokemon => {
                return `${pokemon.name} @ ${pokemon.item || "No Item"}\nAbility: ${pokemon.ability || "Unknown"}\nTera Type: ${pokemon.tera_type}\n- ${pokemon.moves.join("\n- ")}`;
            }).join("\n\n");
            navigator.clipboard.writeText(teamText).then(() => {
                alert("Team copied to clipboard!");
            });
        });
    } catch (error) {
        teamContainer.innerHTML = `<div class="text-red-500 text-center">Sorry, something went wrong. Please try again.</div>`;
    } finally {
        // Hide loading spinner
        searchText.textContent = "Search";
        loadingSpinner.classList.add("hidden");
    }
});