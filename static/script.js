// Light/Dark Mode Toggle
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");

themeToggle.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    const isDarkMode = document.documentElement.classList.contains("dark");
    localStorage.theme = isDarkMode ? "dark" : "light";
    themeIcon.textContent = isDarkMode ? "☀️" : "🌙";
});

// Format Help Toggle
const formatHelpBtn = document.getElementById("format-help-btn");
const formatHelp = document.getElementById("format-help");

formatHelpBtn.addEventListener("click", () => {
    formatHelp.classList.toggle("hidden");
    formatHelp.classList.toggle("animate-fade-in");
});

document.getElementById("search-btn").addEventListener("click", async () => {
    const instruction = document.getElementById("instruction").value;
    if (!instruction) return;

    // Clear previous team and copy button
    const teamContainer = document.getElementById("team-container");
    const copyAllContainer = document.getElementById("copy-all-container");
    const copySuccessMessage = document.getElementById("copy-success-message");
    teamContainer.innerHTML = ""; // Clear the container
    copyAllContainer.classList.add("hidden");
    copySuccessMessage.classList.add("hidden");

    // Show loading spinner
    const searchText = document.getElementById("search-text");
    const loadingSpinner = document.getElementById("loading-spinner");
    searchText.textContent = "Searching...";
    loadingSpinner.classList.remove("hidden");

    await new Promise(resolve => setTimeout(resolve, 500));

    try {
        // Generate the team directly in the browser
        const teams = generatePokepaste(instruction);

        // Shuffle the teams array to randomize the selection
        const shuffledTeams = shuffleArray(teams);

        // Limit the number of teams to 7
        const teamsToDisplay = shuffledTeams.slice(0, 7);

        // Clear any existing title
        const existingTitle = document.querySelector(".team-title");
        if (existingTitle) {
            existingTitle.remove();
        }

        // Display the first team as the main team
        const mainTeam = teamsToDisplay[0];
        const title = `<h2 class="team-title text-3xl font-bold text-center mb-8 text-gray-800 dark:text-gray-100 font-serif">${mainTeam.filename.split('.')[0]}</h2>`;
        teamContainer.insertAdjacentHTML("beforebegin", title);

        // Display the main team
        displayTeam(mainTeam, teamContainer);

        // Display other teams as smaller cards below the main team
        if (teamsToDisplay.length > 1) {
            const otherTeamsNumberTitle = `<h3 class="text-xl font-bold text-center col-span-full mb-4 text-gray-800 dark:text-gray-100">${shuffledTeams.length - 1} other teams match that query</h3>`;
            const otherTeamsTitle = `<h2 class="text-xl font-bold text-center col-span-full mb-4 text-gray-800 dark:text-gray-100">Other similar teams</h2>`;
            teamContainer.insertAdjacentHTML("beforeend", otherTeamsNumberTitle);
            teamContainer.insertAdjacentHTML("beforeend", otherTeamsTitle);

            teamsToDisplay.slice(1).forEach(team => {
                const teamCard = document.createElement("div");
                teamCard.className = "pokemon-card p-2 rounded-lg shadow-md relative bg-amber-100 dark:bg-gray-700";
                teamCard.innerHTML = `
                    <h4 class="text-sm font-bold text-center mb-2 text-gray-800 dark:text-gray-100">${team.filename.split('.')[0]}</h4>
                    <div class="flex justify-center gap-1">
                        ${team.pokemons.map(pokemon => `
                            <div class="flex flex-col items-center">
                                <img src="${pokemon.sprite}" alt="${pokemon.name}" class="w-8 h-8">
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
                copySuccessMessage.classList.remove("hidden");
                setTimeout(() => {
                    copySuccessMessage.classList.add("hidden");
                }, 2000); // Hide the message after 2 seconds
            });
        });
    } catch (error) {
        teamContainer.innerHTML = `<div class="text-red-500 text-center nerdy-font">Sorry, something went wrong. Please try again.</div>`;
        console.log(error);
    } finally {
        // Hide loading spinner
        searchText.textContent = "Search";
        loadingSpinner.classList.add("hidden");
    }
});

// Helper function to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

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