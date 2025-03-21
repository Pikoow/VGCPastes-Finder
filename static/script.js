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
    teamContainer.innerHTML = ""; // Clear the container
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

        // Clear any existing title
        const existingTitle = document.querySelector(".team-title");
        if (existingTitle) {
            existingTitle.remove();
        }

        // Display the first team as the main team
        const mainTeam = data[0];
        const title = `<h2 class="team-title text-3xl font-bold text-center mb-8 text-gray-800 dark:text-gray-100 font-serif">${mainTeam.filename.split('.')[0]}</h2>`;
        teamContainer.insertAdjacentHTML("beforebegin", title);

        // Display the main team
        displayTeam(mainTeam, teamContainer);

        // Display other teams as smaller cards below the main team
        if (data.length > 1) {
            const otherTeamsTitle = `<h3 class="text-xl font-bold text-center col-span-full mb-4 text-gray-800 dark:text-gray-100">Other Matching Teams</h3>`;
            teamContainer.insertAdjacentHTML("beforeend", otherTeamsTitle);

            data.slice(1).forEach(team => {
                const teamCard = document.createElement("div");
                teamCard.className = "pokemon-card p-3 rounded-lg shadow-md relative bg-amber-100 dark:bg-gray-700";
                teamCard.innerHTML = `
                    <h4 class="text-lg font-bold text-center mb-4 text-gray-800 dark:text-gray-100">${team.filename.split('.')[0]}</h4>
                    <div class="grid grid-cols-2 gap-2">
                        ${team.pokemons.map(pokemon => `
                            <div class="flex flex-col items-center">
                                <img src="${pokemon.sprite}" alt="${pokemon.name}" class="w-12 h-12 mb-1">
                                <h5 class="font-bold text-xs text-center">${pokemon.name}</h5>
                            </div>
                        `).join("")}
                    </div>
                `;
                teamContainer.appendChild(teamCard);
            });
        }

        // Show the big copy button for the entire team
        copyAllContainer.classList.remove("hidden");

        // Add event listener for the big copy button
        document.getElementById("copy-all-btn").addEventListener("click", () => {
            const teamText = mainTeam.pokemons.map(pokemon => {
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

function displayTeam(team, container) {
    team.pokemons.forEach(pokemon => {
        const itemSpriteUrl = pokemon.item ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${pokemon.item.toLowerCase().replace(/ /g, '-')}.png` : null;

        const pokemonCard = `
            <div class="pokemon-card p-3 rounded-lg shadow-md relative">
                <div class="grid grid-cols-2 gap-4">
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
        container.innerHTML += pokemonCard;
    });
}

// Handle the format help modal
const formatHelpBtn = document.getElementById("format-help-btn");
const formatHelpModal = document.getElementById("format-help-modal");
const closeModalBtn = document.getElementById("close-modal-btn");

formatHelpBtn.addEventListener("click", () => {
    formatHelpModal.classList.remove("hidden");
});

closeModalBtn.addEventListener("click", () => {
    formatHelpModal.classList.add("hidden");
});

// Close the modal when clicking outside of it
window.addEventListener("click", (event) => {
    if (event.target === formatHelpModal) {
        formatHelpModal.classList.add("hidden");
    }
});