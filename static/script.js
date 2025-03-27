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

const IGNORED_WORDS = new Set([
    'a', 'an', 'the', 'and', 'with', 'holding', 'team', 'i', 'want', 
    'need', 'looking', 'for', 'that', 'has', 'have', 'had', 'my',
    'your', 'our', 'their', 'this', 'these', 'those', 'some', 'any',
    'all', 'every', 'each', 'which', 'what', 'when', 'where', 'why',
    'how', 'many', 'much', 'more', 'less', 'most', 'least', 'only',
    'just', 'also', 'too', 'very', 'really', 'quite', 'somewhat',
    'rather', 'about', 'around', 'over', 'under', 'above', 'below',
    'between', 'among', 'through', 'during', 'before', 'after',
    'while', 'since', 'until', 'from', 'to', 'into', 'onto', 'upon',
    'of', 'in', 'out', 'on', 'off', 'up', 'down', 'at', 'by', 'for',
    'via', 'per', 'as', 'like', 'unlike', 'such', 'so', 'thus',
    'therefore', 'however', 'nevertheless', 'nonetheless', 'otherwise',
    'then', 'than', 'though', 'although', 'even', 'if', 'unless',
    'because', 'since', 'so', 'that', 'whether', 'while', 'once',
    'twice', 'thrice', 'times', 'time', 'times', 'here', 'there',
    'where', 'everywhere', 'nowhere', 'somewhere', 'anywhere', 'else',
    'other', 'another', 'others', 'elsewhere', 'whatever', 'whoever',
    'whichever', 'whenever', 'wherever', 'however', 'whyever', 'no',
    'not', 'none', 'nothing', 'nobody', 'nowhere', 'never', 'neither',
    'nor', 'either', 'or', 'both', 'whether', 'yes', 'yeah', 'yep',
    'nope', 'nah', 'ok', 'okay', 'alright', 'sure', 'certainly',
    'definitely', 'absolutely', 'probably', 'possibly', 'maybe',
    'perhaps', 'usually', 'often', 'sometimes', 'rarely', 'seldom',
    'never', 'always', 'frequently', 'generally', 'normally',
    'typically', 'occasionally', 'constantly', 'continually',
    'continuously', 'regularly', 'periodically', 'yearly', 'monthly',
    'weekly', 'daily', 'hourly', 'annually', 'biannually', 'biennially',
    'triennially', 'quarterly', 'semiannually', 'midyear', 'midsummer',
    'midwinter', 'midspring', 'midautumn', 'midfall', 'midseason',
    'midterm', 'midpoint', 'midway', 'midnight', 'midday', 'noon',
    'midmorning', 'midafternoon', 'midweek', 'midmonth', 'midyear',
    'midevening', 'midnight', 'midday', 'noon', 'midmorning',
    'midafternoon', 'midweek', 'midmonth', 'midyear', 'midevening'
]);

function findClosestPokemonName(input) {
    if (!input.trim()) return null;
    
    const inputLower = input.toLowerCase();
    
    // Skip ignored words
    if (IGNORED_WORDS.has(inputLower)) return null;
    
    // Skip words that are too short or too long to be Pokémon names
    if (inputLower.length < 4 || inputLower.length > 20) return null;
    
    const pokemonNames = [...window.pokemonNames];
    
    // Exact match check
    if (pokemonNames.includes(inputLower)) return null;
    
    // Find similar names using Levenshtein distance
    let closest = null;
    let minDistance = Infinity;
    
    for (const name of pokemonNames) {
        // Skip if the lengths are too different
        if (Math.abs(name.length - inputLower.length) > 3) continue;
        
        // Skip if the beginning matches exactly (user is probably typing)
        if (name.startsWith(inputLower) && inputLower.length < 4) return null;
        
        // Simple similarity check (partial match)
        if (name.includes(inputLower) || inputLower.includes(name)) {
            return name; // Return first partial match
        }
        
        // More advanced distance calculation
        const distance = levenshteinDistance(inputLower, name);
        if (distance < minDistance && distance <= 3) { // Only suggest if very close (max 2 changes)
            minDistance = distance;
            closest = name;
        }
    }
    
    return closest;
}

// Levenshtein distance function for string similarity
function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

document.getElementById("instruction").addEventListener("input", function() {
    const input = this.value;
    const didYouMeanDiv = document.getElementById("did-you-mean");
    const suggestionLink = document.getElementById("suggestion-link");
    
    // Split input into words and check each one
    const words = input.split(/\s+/);
    let suggestion = null;
    
    for (const word of words) {
        // Skip words that are obviously not Pokémon names
        if (word.length < 4 || word.length > 20) continue;
        if (IGNORED_WORDS.has(word.toLowerCase())) continue;
        
        const closest = findClosestPokemonName(word);
        if (closest) {
            // Create the suggestion by replacing just this word
            suggestion = input.replace(
                new RegExp(`\\b${word}\\b`, 'i'), 
                closest.charAt(0).toUpperCase() + closest.slice(1) // Capitalize first letter
            );
            break;
        }
    }
    
    if (suggestion) {
        suggestionLink.textContent = `"${suggestion}"`;
        suggestionLink.onclick = (e) => {
            e.preventDefault();
            document.getElementById("instruction").value = suggestion;
            document.getElementById("search-btn").click();
            didYouMeanDiv.classList.add("hidden");
        };
        didYouMeanDiv.classList.remove("hidden");
    } else {
        didYouMeanDiv.classList.add("hidden");
    }
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

    // Clear any existing title
    const existingTitle = document.querySelector(".team-title");
    if (existingTitle) {
        existingTitle.remove();
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    try {
        // Generate the team directly in the browser
        const [teams, noDetect] = generatePokepaste(instruction);

        // Shuffle the teams array to randomize the selection
        const shuffledTeams = shuffleArray(teams);

        // Limit the number of teams to 7
        let teamsToDisplay = shuffledTeams.slice(0, 7);

        // Display the first team as the main team
        const mainTeam = teamsToDisplay[0];
        const title = `<h2 class="team-title text-3xl font-bold text-center mb-8 text-gray-800 dark:text-gray-100 font-serif">${mainTeam.filename.split('.')[0]}</h2>`;
        teamContainer.insertAdjacentHTML("beforebegin", title);

        // Display the main team
        displayTeam(mainTeam, teamContainer);

        if (noDetect) {
            teamsToDisplay = {};

            const otherTeamsNumberTitle = `<h3 class="text-xl font-bold text-center col-span-full text-gray-800 dark:text-gray-100">We couldn't find teams matching your search, so here's a random team!</h3>`;
            teamContainer.insertAdjacentHTML("beforeend", otherTeamsNumberTitle);
        }

        // Display other teams as smaller cards below the main team
        if (teamsToDisplay.length > 1) {
            const otherTeamsNumberTitle = `<h3 class="text-xl font-bold text-center col-span-full text-gray-800 dark:text-gray-100">${shuffledTeams.length - 1} other teams match that query</h3>`;
            teamContainer.insertAdjacentHTML("beforeend", otherTeamsNumberTitle);

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

        // Show the copy button for the entire team
        copyAllContainer.classList.remove("hidden");

        // Add event listener for the copy button
        document.getElementById("copy-all-btn").addEventListener("click", () => {
            const teamText = mainTeam.pokemons.map(pokemon => {
                return `${pokemon.name} @ ${pokemon.item || "No Item"}\nAbility: ${pokemon.ability || "Unknown"}\nTera Type: ${pokemon.tera_type}\n- ${pokemon.moves.join("\n- ")}`;
            }).join("\n\n");
            
            navigator.clipboard.writeText(teamText).then(() => {
                const message = document.getElementById("global-copy-message");
                message.classList.remove("hidden");
                message.classList.add("show");
                
                setTimeout(() => {
                    message.classList.remove("show");
                    setTimeout(() => message.classList.add("hidden"), 300);
                }, 2000);
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