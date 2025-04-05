// --- Theme Toggle ---
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");

function applyTheme(isDarkMode) {
    if (isDarkMode) {
        document.documentElement.classList.add("dark");
        themeIcon.textContent = "☀️";
        localStorage.theme = "dark";
    } else {
        document.documentElement.classList.remove("dark");
        themeIcon.textContent = "🌙";
        localStorage.theme = "light";
    }
}

themeToggle.addEventListener("click", () => {
    const isDarkMode = !document.documentElement.classList.contains("dark");
    applyTheme(isDarkMode);
});

applyTheme(localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches));


// --- Query Builder UI ---
const addCriteriaBtn = document.getElementById('add-criteria-btn');
const addCriteriaMenu = document.getElementById('add-criteria-menu');
const criteriaContainer = document.getElementById('criteria-container');
const criteriaTemplates = document.getElementById('criteria-templates');

let isDataReady = false; // Flag to track if DataService is initialized

// --- Populate Select Options ---
// These functions create the <option> elements for the dropdowns.
function populateSelectWithOptions(selectElement, optionsArray, placeholder, valueFormatter = val => val.toLowerCase().replace(/ /g, '-'), textFormatter = val => val) {
    selectElement.innerHTML = ''; // Clear existing options
    // Add placeholder option
    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = "";
    placeholderOpt.textContent = placeholder;
    placeholderOpt.disabled = true; // Disable placeholder
    placeholderOpt.selected = true; // Select placeholder by default
    selectElement.appendChild(placeholderOpt);

    // Add 'Any' option for optional fields
    if (selectElement.dataset.field !== 'pokemonName' && selectElement.dataset.field !== 'value') { // Don't add "Any" to primary selectors
        const anyOpt = document.createElement('option');
        anyOpt.value = ""; // Treat empty value as "Any"
        anyOpt.textContent = `-- Any ${selectElement.dataset.field?.charAt(0).toUpperCase() + selectElement.dataset.field?.slice(1) || 'Value'} --`;
        selectElement.appendChild(anyOpt);
    }

    // Add actual options
    optionsArray.forEach(optionValue => {
        if (!optionValue) return; // Skip null/empty options
        const option = document.createElement('option');
        option.value = valueFormatter(optionValue);
        // Try to get original casing for display text using DataService helper
        option.textContent = DataService.getOriginalCaseForSelect(selectElement.closest('[data-type]')?.dataset.type || selectElement.dataset.field || 'unknown', optionValue);
        // Fallback if helper not perfect:
        // option.textContent = textFormatter(optionValue);
        selectElement.appendChild(option);
    });
}

// Function to set up all selects once data is ready
function initializeSelects() {
    if (!isDataReady) {
        console.warn("Data not ready, cannot initialize selects yet.");
        return;
    }
    console.log("Initializing select options...");

    // Get template selects
    const pokemonTemplate = criteriaTemplates.querySelector('.pokemon-block');
    const generalTemplate = criteriaTemplates.querySelector('.general-block');

    // Populate Pokémon template selects
    populateSelectWithOptions(pokemonTemplate.querySelector('.pokemon-select'), DataService.getAllPokemonNamesLower(), '-- Select Pokémon --', val => val.toLowerCase(), DataService.getOriginalCaseName);
    populateSelectWithOptions(pokemonTemplate.querySelector('.item-select'), DataService.getAllItemsLower(), '-- Any Item --');
    populateSelectWithOptions(pokemonTemplate.querySelector('.ability-select'), DataService.getAllAbilitiesLower(), '-- Any Ability --');
    populateSelectWithOptions(pokemonTemplate.querySelector('.tera-select'), DataService.getAllTeraTypesLower(), '-- Any Tera --');
    const moveSelects = pokemonTemplate.querySelectorAll('.move-select');
    moveSelects.forEach(select => populateSelectWithOptions(select, DataService.getAllMovesLower(), '-- Any Move --'));

    // Store options for general templates (to be used when adding general criteria)
    generalSelectOptions = {
         item: DataService.getAllItemsLower(),
         ability: DataService.getAllAbilitiesLower(),
         move: DataService.getAllMovesLower(),
         tera: DataService.getAllTeraTypesLower(),
         role: DataService.getAllRolesLower(),
    };

    console.log("Select options initialized.");
    // Enable the Add button now that selects can be populated
    addCriteriaBtn.disabled = false;
    addCriteriaBtn.title = "Add criteria to search for";
}

// Store options globally for easy access when creating general blocks
let generalSelectOptions = {};

// Listen for the 'dataReady' event from generate.js
document.addEventListener('dataReady', () => {
    isDataReady = true;
    initializeSelects(); // Populate selects now that data is available
});

// Disable Add button initially until data is ready
addCriteriaBtn.disabled = true;
addCriteriaBtn.title = "Loading data...";


// --- Add/Remove Criteria Logic ---

// Show/Hide Add Criteria Menu
addCriteriaBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent click from immediately closing menu
    addCriteriaMenu.classList.toggle('hidden');
});

// Hide menu when clicking outside
document.addEventListener('click', (e) => {
    if (!addCriteriaBtn.contains(e.target) && !addCriteriaMenu.contains(e.target)) {
        addCriteriaMenu.classList.add('hidden');
    }
});

// Handle adding a criterion when a menu item is clicked
addCriteriaMenu.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target.closest('.criteria-menu-item');
    if (target && target.dataset.type) {
        addCriteriaBlock(target.dataset.type);
        addCriteriaMenu.classList.add('hidden'); // Hide menu after selection
    }
});

// Function to add a new criteria block to the container
function addCriteriaBlock(type) {
    let template;
    let newBlock;

    if (type === 'pokemon') {
        template = criteriaTemplates.querySelector('.pokemon-block');
        newBlock = template.cloneNode(true);
    } else { // General types (item, ability, move, tera, role)
        template = criteriaTemplates.querySelector('.general-block');
        newBlock = template.cloneNode(true);
        newBlock.dataset.type = type; // Set specific type

        const label = newBlock.querySelector('.criteria-label');
        const select = newBlock.querySelector('.value-select');
        const options = generalSelectOptions[type] || [];
        const placeholder = `-- Select ${type.charAt(0).toUpperCase() + type.slice(1)} --`;

        label.textContent = `General ${type.charAt(0).toUpperCase() + type.slice(1)}`;
        populateSelectWithOptions(select, options, placeholder);
        newBlock.querySelector('.remove-criteria-btn').title = `Remove ${type} criterion`;
    }

    // Add remove functionality to the new block's button
    const removeBtn = newBlock.querySelector('.remove-criteria-btn');
    removeBtn.addEventListener('click', () => {
        newBlock.remove();
        // Optionally trigger search automatically after removing? Or wait for user.
    });

    criteriaContainer.appendChild(newBlock);

    // Hide initial message if it's visible
    if(initialMessage) initialMessage.classList.add('hidden');
}

// --- Search Functionality ---
const searchBtn = document.getElementById("search-btn");
const teamContainer = document.getElementById("team-container");
const teamSheetContainer = document.getElementById("team-sheet-container");
const teamHeader = document.getElementById("team-header");
const teamTitle = document.getElementById("team-title");
const copyAllBtn = document.getElementById("copy-all-btn");
const otherTeamsContainer = document.getElementById("other-teams-container");
const otherTeamsTitle = document.getElementById("other-teams-title");
const otherTeamsList = document.getElementById("other-teams-list");
const searchText = document.getElementById("search-text");
const loadingSpinner = document.getElementById("loading-spinner");
const initialMessage = document.getElementById("initial-message");

let currentSearchResults = [];
let currentMainTeamIndex = -1;

// Function to gather the structured query from the UI
function buildQueryFromUI() {
    const criteria = [];
    const blocks = criteriaContainer.querySelectorAll('.criteria-block');

    blocks.forEach(block => {
        const type = block.dataset.type;
        const criterion = { type };

        if (type === 'pokemon') {
            const pokemonName = block.querySelector('.pokemon-select').value;
            // Only add pokemon criterion if a pokemon is actually selected
            if (pokemonName) {
                 criterion.pokemonName = pokemonName;
                 criterion.item = block.querySelector('.item-select').value || null; // Use null if empty
                 criterion.ability = block.querySelector('.ability-select').value || null;
                 criterion.tera = block.querySelector('.tera-select').value || null;
                 criterion.move1 = block.querySelector('[data-field="move1"]').value || null;
                 criterion.move2 = block.querySelector('[data-field="move2"]').value || null;
                 criterion.move3 = block.querySelector('[data-field="move3"]').value || null;
                 criterion.move4 = block.querySelector('[data-field="move4"]').value || null;
                 // Filter out null moves before potentially adding? Matcher handles nulls now.
                 criteria.push(criterion);
            }
        } else { // General criteria
            const value = block.querySelector('.value-select').value;
            // Only add general criterion if a value is selected
            if (value) {
                criterion.value = value;
                criteria.push(criterion);
            }
        }
    });
    return criteria;
}


// Function to trigger the search process
async function triggerSearch() {
    const queryCriteria = buildQueryFromUI();

    if (queryCriteria.length === 0) {
        // Optionally show a message telling user to add criteria
        teamTitle.textContent = 'Build a Query';
        teamContainer.innerHTML = `<div class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">Add criteria using the button above to start searching for teams.</div>`;
        copyAllBtn.classList.add('hidden');
        otherTeamsContainer.classList.add('hidden');
        return;
    }

    // --- UI Updates: Start Loading ---
    if (initialMessage) initialMessage.classList.add('hidden');
    searchText.textContent = "Searching";
    loadingSpinner.classList.remove("hidden");
    searchBtn.disabled = true;
    addCriteriaBtn.disabled = true; // Disable adding more while searching
    teamContainer.innerHTML = '';
    teamTitle.textContent = 'Loading Team...';
    copyAllBtn.classList.add('hidden');
    otherTeamsContainer.classList.add('hidden');
    otherTeamsTitle.classList.add('hidden');
    otherTeamsList.innerHTML = '';
    currentSearchResults = [];
    currentMainTeamIndex = -1;

    console.log("Starting search with criteria:", queryCriteria);
    await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause

    try {
        // Call the generation function from generate.js with the structured query
        const teams = await window.generatePokepaste(queryCriteria); // Returns only teams array

        if (!teams || teams.length === 0) {
            teamTitle.textContent = 'No Results';
            teamContainer.innerHTML = `<div class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">No teams found matching your query. Try adjusting the criteria.</div>`;
            otherTeamsContainer.classList.add('hidden');
        } else {
             currentSearchResults = teams;
             currentMainTeamIndex = 0;
             const mainTeam = currentSearchResults[currentMainTeamIndex];
             updateMainTeamDisplay(mainTeam);

             if (currentSearchResults.length > 1) {
                 updateOtherTeamsDisplay();
             } else {
                  otherTeamsContainer.classList.add('hidden');
             }
        }

    } catch (error) {
        console.error("Error during search:", error);
        teamTitle.textContent = 'Error';
        teamContainer.innerHTML = `<div class="p-4 text-center text-red-500 dark:text-red-400 text-sm">Sorry, something went wrong during the search. Please check the console for details.<br><span class="text-xs">${error.message}</span></div>`;
        copyAllBtn.classList.add('hidden');
        otherTeamsContainer.classList.add('hidden');
        currentSearchResults = [];
        currentMainTeamIndex = -1;
    } finally {
        // --- UI Updates: End Loading ---
        searchText.textContent = "Search";
        loadingSpinner.classList.add("hidden");
        searchBtn.disabled = false;
        addCriteriaBtn.disabled = !isDataReady; // Re-enable add button only if data is ready
    }
}

// Event listener for the search button
searchBtn.addEventListener("click", triggerSearch);

// --- Display Functions (Mostly Unchanged) ---

function updateMainTeamDisplay(team) {
    if (!team) return;
    teamTitle.textContent = team.filename.split('.')[0].replace(/_/g, ' ');
    displayTeamInGrid(team, teamContainer);
    copyAllBtn.classList.remove('hidden');
    copyAllBtn.onclick = () => copyTeamToClipboard(team);
}

function updateOtherTeamsDisplay() {
    otherTeamsList.innerHTML = '';
    const otherTeams = currentSearchResults.filter((_, index) => index !== currentMainTeamIndex);

    if (otherTeams.length > 0) {
        otherTeamsContainer.classList.remove('hidden');
        otherTeamsTitle.textContent = `${otherTeams.length} other potential match${otherTeams.length > 1 ? 'es' : ''}:`;
        otherTeamsTitle.classList.remove('hidden');

        currentSearchResults.forEach((team, index) => {
            if (index === currentMainTeamIndex) return;

            const teamPreview = document.createElement('div');
            teamPreview.className = 'other-team-preview border p-1.5 rounded-sm cursor-pointer';
            teamPreview.title = `Click to view: ${team.filename.split('.')[0].replace(/_/g, ' ')}`;
            teamPreview.dataset.teamIndex = index;

            const teamName = document.createElement('div');
            teamName.className = 'text-xs font-semibold truncate mb-1 team-name-preview';
            teamName.textContent = team.filename.split('.')[0].replace(/_/g, ' ');
            teamPreview.appendChild(teamName);

            const spriteContainer = document.createElement('div');
            spriteContainer.className = 'flex flex-wrap gap-1 justify-center';
            team.pokemons.slice(0, 6).forEach(pokemon => {
                 if (!pokemon) return;
                const img = document.createElement('img');
                img.src = pokemon.sprite || 'static/assets/pokeball_icon.png';
                img.alt = pokemon.name || '';
                img.className = 'w-5 h-5 object-contain';
                img.onerror = () => { img.src = 'static/assets/pokeball_icon.png'; };
                spriteContainer.appendChild(img);
            });
            teamPreview.appendChild(spriteContainer);

            teamPreview.addEventListener('click', () => {
                const clickedIndex = parseInt(teamPreview.dataset.teamIndex, 10);
                currentMainTeamIndex = clickedIndex;
                updateMainTeamDisplay(currentSearchResults[currentMainTeamIndex]);
                updateOtherTeamsDisplay();
                teamSheetContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });

            otherTeamsList.appendChild(teamPreview);
        });
    } else {
        otherTeamsContainer.classList.add('hidden');
        otherTeamsTitle.classList.add('hidden');
    }
}

function displayTeamInGrid(team, container) {
    container.innerHTML = '';

    if (!team || !team.pokemons || team.pokemons.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">Team data is empty or invalid.</div>`;
        return;
    }

    const headerRow = document.createElement('div');
    headerRow.className = 'excel-row header-row';
    headerRow.innerHTML = `
        <div class="excel-cell font-semibold">Sprite</div>
        <div class="excel-cell font-semibold">Pokémon</div>
        <div class="excel-cell font-semibold">Item</div>
        <div class="excel-cell font-semibold">Ability</div>
        <div class="excel-cell font-semibold">Tera Type</div>
        <div class="excel-cell font-semibold">Move 1</div>
        <div class="excel-cell font-semibold">Move 2</div>
        <div class="excel-cell font-semibold">Move 3</div>
        <div class="excel-cell font-semibold">Move 4</div>
    `;
    container.appendChild(headerRow);

    team.pokemons.forEach((pokemon, index) => {
         if (!pokemon) return;

        const row = document.createElement('div');
        const altClass = index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-excel-dark-alt';
        row.className = `excel-row ${altClass}`;

        const itemName = pokemon.item && pokemon.item !== "None" ? pokemon.item : null;
        const itemSpriteUrl = itemName
            ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${itemName.toLowerCase().replace(/ /g, '-')}.png`
            : null;

        const teraType = pokemon.tera_type && pokemon.tera_type !== "None" ? pokemon.tera_type : "None";
        const teraClass = teraType !== "None" ? `type-${teraType.toLowerCase()}` : 'type-none';

        const moves = [...(pokemon.moves || [])];
        while (moves.length < 4) {
            moves.push({ name: '-', type: 'unknown' });
        }

        let itemCellHTML = `<span class="text-gray-400 dark:text-gray-500 italic text-xs">None</span>`;
        if (itemName) {
            const safeItemName = itemName.replace(/"/g, '"').replace(/'/g, '"'); // Sanitize for attributes
            itemCellHTML = `
                <img src="${itemSpriteUrl}" alt="${safeItemName}" class="w-4 h-4 mr-1 inline-block object-contain"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"
                     onload="this.style.display='inline'; this.nextElementSibling.style.display='none';"
                     title="${safeItemName}">
                <span class="item-fallback-text" style="display:none;">${itemName}</span>
            `;
        }

        row.innerHTML = `
            <div class="excel-cell cell-sprite">
                <img src="${pokemon.sprite || 'static/assets/pokeball_icon.png'}" alt="${pokemon.name || 'Pokemon'}" class="w-8 h-8 mx-auto object-contain" onerror="this.onerror=null; this.src='static/assets/pokeball_icon.png';">
            </div>
            <div class="excel-cell font-medium cell-wrap">${pokemon.name || 'Unknown'}</div>
            <div class="excel-cell cell-item">${itemCellHTML}</div>
            <div class="excel-cell text-xs cell-wrap">${pokemon.ability || 'None'}</div>
            <div class="excel-cell cell-tera">
                ${teraType !== "None" ? `<span class="tera-badge-excel ${teraClass}">${teraType}</span>` : `<span class="text-gray-400 dark:text-gray-500 italic text-xs">None</span>`}
            </div>
            ${moves.slice(0, 4).map(move => {
                const moveName = move?.name || '-';
                const moveType = move?.type?.toLowerCase() || 'unknown';
                const displayType = moveType.charAt(0).toUpperCase() + moveType.slice(1);
                const safeMoveName = moveName.replace(/"/g, '"').replace(/'/g, '"');
                return `
                <div class="excel-cell cell-move text-xs">
                    ${moveName !== '-' ? `
                        <span class="type-badge-excel type-${moveType} mr-1" title="${displayType} Type">${moveType.substring(0, 3).toUpperCase() || '?'}</span>
                        ${safeMoveName}
                    ` : `
                        <span class="text-gray-400 dark:text-gray-500">-</span>
                    `}
                </div>
            `}).join("")}
        `;
        container.appendChild(row);
    });
}


// --- Utility Functions (Copy Paste Unchanged) ---
function copyTeamToClipboard(team) {
    if (!team || !team.pokemons) return;

    const teamText = team.pokemons.map(pokemon => {
        if (!pokemon) return "";

         const name = pokemon.name || "Unknown";
         const item = pokemon.item && pokemon.item !== "None" ? ` @ ${pokemon.item}` : "";
         const ability = pokemon.ability && pokemon.ability !== "None" ? `Ability: ${pokemon.ability}` : "";
         const tera = pokemon.tera_type && pokemon.tera_type !== "None" ? `Tera Type: ${pokemon.tera_type}` : "";

         const moves = (pokemon.moves || [])
             .map(m => (m && m.name && m.name !== '-') ? `- ${m.name}` : null)
             .filter(m => m !== null);

        let pokemonString = `${name}${item}\n`;
        if (ability) pokemonString += `${ability}\n`;
        if (tera) pokemonString += `${tera}\n`;
        if (moves.length > 0) pokemonString += `${moves.join("\n")}`;

        return pokemonString.trim();
    }).filter(Boolean).join("\n\n");

    navigator.clipboard.writeText(teamText).then(() => {
        const message = document.getElementById("global-copy-message");
        message.classList.add("visible");
        if (message.timeoutId) clearTimeout(message.timeoutId);
        message.timeoutId = setTimeout(() => {
             message.classList.remove("visible");
             message.timeoutId = null;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy team:', err);
        alert("Failed to copy team to clipboard.");
    });
}

// --- Initial Setup ---
// (Data loading and select initialization is handled by the 'dataReady' event)
console.log("script.js loaded.");