// Light/Dark Mode Toggle
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");

themeToggle.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    const isDarkMode = document.documentElement.classList.contains("dark");
    localStorage.theme = isDarkMode ? "dark" : "light";
    themeIcon.textContent = isDarkMode ? "☀️" : "🌙";
});

document.getElementById("search-btn").addEventListener("click", async () => {
    const instruction = document.getElementById("instruction").value;
    if (!instruction) return;

    // Clear previous team and copy button
    const teamContainer = document.getElementById("team-container");
    const copyAllContainer = document.getElementById("copy-all-container");
    teamContainer.innerHTML = "";
    copyAllContainer.classList.add("hidden");

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

        const existingTitle = document.querySelector(".team-title");
        if (existingTitle) {
            existingTitle.remove();
        }

        const title = `<h2 class="team-title text-3xl font-bold text-center mb-8 text-gray-800 dark:text-gray-100 font-serif">${data.filename.split('.')[0]}</h2>`;
        teamContainer.insertAdjacentHTML("beforebegin", title);

        // Display the team
        data.pokemons.forEach(pokemon => {
            // Use Pokémon Showdown's item sprite URL for item images
            const itemSpriteUrl = pokemon.item ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${pokemon.item.toLowerCase().replace(/ /g, '-')}.png` : null;

            const pokemonCard = `
                <div class="pokemon-card p-3 rounded-lg shadow-md relative">
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Left Side: Image, Name, Item -->
                        <div class="flex flex-col items-center">
                            <img src="${pokemon.sprite}" alt="${pokemon.name}" class="w-16 h-16 mb-2" onerror="this.onerror=null; this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png';">
                            <h3 class="font-bold text-sm text-center nerdy-font">${pokemon.name}</h3>
                            <div class="flex items-center mt-1">
                                ${pokemon.item ? `
                                    <img src="${itemSpriteUrl}" alt="${pokemon.item}" class="w-4 h-4 mr-1" onerror="this.onerror=null; this.style.display='none';">
                                ` : ''}
                                <p class="text-xs text-gray-600 dark:text-gray-400 nerdy-font">${pokemon.item || "No Item"}</p>
                            </div>
                        </div>
                        <!-- Right Side: Tera Type and Moves -->
                        <div class="flex flex-col">
                            <p class="text-xs text-gray-600 dark:text-gray-400 mb-2 nerdy-font">
                                <span class="font-semibold">Ability:</span> ${pokemon.ability}
                            </p>
                            <p class="text-xs text-gray-600 dark:text-gray-400 mb-2 nerdy-font">
                                <span class="font-semibold">Tera Type:</span> ${pokemon.tera_type}
                            </p>
                            <ul class="text-xs text-gray-500 dark:text-gray-300 nerdy-font">
                                ${pokemon.moves.map(move => `<li>${move}</li>`).join("")}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
            teamContainer.innerHTML += pokemonCard;
        });

        // Show the big copy button for the entire team
        copyAllContainer.classList.remove("hidden");

        // Add event listener for the big copy button
        document.getElementById("copy-all-btn").addEventListener("click", () => {
            const teamText = data.pokemons.map(pokemon => {
                return `${pokemon.name} @ ${pokemon.item || "No Item"}\nAbility: ${pokemon.ability || "Unknown"}\nTera Type: ${pokemon.tera_type}\n- ${pokemon.moves.join("\n- ")}`;
            }).join("\n\n");
            navigator.clipboard.writeText(teamText).then(() => {
                alert("Entire team copied to clipboard!");
            });
        });
    } catch (error) {
        teamContainer.innerHTML = `<div class="text-red-500 text-center nerdy-font">Sorry, something went wrong. Please try again.</div>`;
    } finally {
        // Hide loading spinner
        searchText.textContent = "Search";
        loadingSpinner.classList.add("hidden");
    }
});