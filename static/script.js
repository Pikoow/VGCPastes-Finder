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
const deleteAllCriteriaBtn = document.getElementById('delete-all-criteria-btn');
const initialMessage = document.getElementById("initial-message");

let isDataReady = false; // Flag to track if DataService is initialized

// --- Populate Select Options ---
function populateSelectWithOptions(selectElement, optionsArray, placeholder, valueFormatter = val => val.toLowerCase().replace(/ /g, '-'), textFormatter = val => val, addAnyOption = true) {
    selectElement.innerHTML = ''; // Clear existing options

    const currentVal = selectElement.value; // Store current value if needed (useful for re-populating)

    // Add placeholder option
    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = "";
    placeholderOpt.textContent = placeholder;
    // Disable placeholder unless it's the only option or explicitly selected
    placeholderOpt.disabled = optionsArray.length > 0;
    placeholderOpt.selected = !currentVal; // Select placeholder if no value was previously selected
    selectElement.appendChild(placeholderOpt);

    // Add 'Any' option for optional fields (controlled by addAnyOption flag)
    // Check dataset.field to avoid adding "Any" to primary pokemon/value selects
    const isPrimarySelector = selectElement.dataset.field === 'pokemonName' || selectElement.dataset.field === 'value';
    if (addAnyOption && !isPrimarySelector) {
        const anyOpt = document.createElement('option');
        anyOpt.value = ""; // Treat empty value as "Any"
        // Make "Any" text more specific based on field name if possible
        let fieldName = selectElement.dataset.field || 'value';
        fieldName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1'); // Format field name
        anyOpt.textContent = `Any ${fieldName}`;
        selectElement.appendChild(anyOpt);
         // Ensure placeholder isn't selected if "Any" exists and no value was previously selected
        if (!currentVal) placeholderOpt.selected = false;
    }


    // Add actual options
    optionsArray.forEach(optionValue => {
        if (!optionValue) return; // Skip null/empty options
        const option = document.createElement('option');
        const formattedValue = valueFormatter(optionValue);
        option.value = formattedValue;

        // Determine type for original case lookup
        let type = selectElement.closest('[data-type]')?.dataset.type || 'unknown';
        if (selectElement.dataset.field && ['item', 'ability', 'move', 'tera', 'role', 'pokemonName'].includes(selectElement.dataset.field)) {
            // Map field name to type if possible
            if (selectElement.dataset.field === 'pokemonName') type = 'pokemon';
            else if (selectElement.dataset.field === 'tera') type = 'tera';
            else if (selectElement.dataset.field === 'role') type = 'role';
            else type = selectElement.dataset.field; // ability, item, move
        }

        option.textContent = DataService.getOriginalCaseForSelect(type, optionValue);
        selectElement.appendChild(option);

        // Reselect previous value if it exists in the new options
        if (currentVal && formattedValue === currentVal) {
            option.selected = true;
            placeholderOpt.selected = false; // Ensure placeholder is not selected
        }
    });

     // If no value was selected previously AND no option matches a potential default, select the placeholder or "Any"
     if (!selectElement.querySelector('option[selected]')) {
         const anyOption = selectElement.querySelector('option[value=""][disabled="false"]'); // Find non-disabled "Any" or empty value option
         if (anyOption) {
             anyOption.selected = true;
             placeholderOpt.selected = false;
         } else {
             placeholderOpt.selected = true; // Fallback to placeholder
         }
     }
}

function updateDeleteAllButtonVisibility() {
    if (criteriaContainer.children.length > 0) {
        deleteAllCriteriaBtn.classList.remove('hidden');
    } else {
        deleteAllCriteriaBtn.classList.add('hidden');
        if (initialMessage) initialMessage.classList.remove('hidden'); // Show initial message if empty
    }
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
    // Pokemon Name
    populateSelectWithOptions(pokemonTemplate.querySelector('.pokemon-select'), DataService.getAllPokemonNamesLower(), '-- Select Pokémon --', val => val.toLowerCase(), DataService.getOriginalCaseName, false); // No "Any" for primary Pokemon select
    // Item (Use items from dataset only)
    populateSelectWithOptions(pokemonTemplate.querySelector('.item-select'), DataService.getItemsInDatasetLower(), '-- Items --');
    // Ability (Initially populate with all from dataset, will be filtered on Pokemon selection)
    populateSelectWithOptions(pokemonTemplate.querySelector('.ability-select'), DataService.getAbilitiesInDatasetLower(), '-- Abilities --');
    // Tera
    populateSelectWithOptions(pokemonTemplate.querySelector('.tera-select'), DataService.getAllTeraTypesLower(), '-- Tera Types --');
    // Moves (Initially populate with all from dataset, will be filtered on Pokemon selection)
    const moveSelects = pokemonTemplate.querySelectorAll('.move-select');
    moveSelects.forEach(select => populateSelectWithOptions(select, DataService.getMovesInDatasetLower(), '-- Moves --'));

    // Store options for general templates (use *InDataset lists for consistency)
    generalSelectOptions = {
         item: DataService.getItemsInDatasetLower(),
         ability: DataService.getAbilitiesInDatasetLower(),
         move: DataService.getMovesInDatasetLower(),
         tera: DataService.getAllTeraTypesLower(),
         role: DataService.getAllRolesLower(),
    };

    console.log("Select options initialized.");
    addCriteriaBtn.disabled = false; // Enable Add button
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
    e.stopPropagation();
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
        addCriteriaMenu.classList.add('hidden');
    }
});

// Function to add a new criteria block to the container
function addCriteriaBlock(type) {
    let template;
    let newBlock;

    if (!isDataReady) {
        console.error("Cannot add criteria: Data is not ready yet.");
        // Optionally show a user message
        return;
    }

    if (type === 'pokemon') {
        template = criteriaTemplates.querySelector('.pokemon-block');
        newBlock = template.cloneNode(true);
        // Initial population uses the pre-filled template (all pokemon, all dataset abilities/moves)
    } else { // General types
        template = criteriaTemplates.querySelector('.general-block');
        newBlock = template.cloneNode(true);
        newBlock.dataset.type = type; // Set specific type

        const label = newBlock.querySelector('.criteria-label');
        const select = newBlock.querySelector('.value-select');
        const options = generalSelectOptions[type] || [];
        const placeholder = `-- Select ${type.charAt(0).toUpperCase() + type.slice(1)} --`;

        label.textContent = `General ${type.charAt(0).toUpperCase() + type.slice(1)}`;
        // Use addAnyOption=false because the placeholder serves as "Any" for general criteria
        populateSelectWithOptions(select, options, placeholder, undefined, undefined, false);
        newBlock.querySelector('.remove-criteria-btn').title = `Remove ${type} criterion`;
    }

    const removeBtn = newBlock.querySelector('.remove-criteria-btn');
    removeBtn.addEventListener('click', () => {
        newBlock.remove();
        // Hide initial message if container becomes empty
        if(criteriaContainer.children.length === 0 && initialMessage) {
             initialMessage.classList.remove('hidden');
        }
    });

    criteriaContainer.appendChild(newBlock);
    if(initialMessage) initialMessage.classList.add('hidden'); // Hide initial message
    updateDeleteAllButtonVisibility();
}

// --- Event Listener for Pokémon Selection Change ---
criteriaContainer.addEventListener('change', (event) => {
    // Check if the changed element is a pokemon-select inside a pokemon-block
    if (event.target.classList.contains('pokemon-select') && event.target.closest('.pokemon-block')) {
        const pokemonBlock = event.target.closest('.pokemon-block');
        const selectedPokemonName = event.target.value; // This is already lowercase

        const abilitySelect = pokemonBlock.querySelector('.ability-select');
        const moveSelects = pokemonBlock.querySelectorAll('.move-select');

        if (!selectedPokemonName) {
            // If "-- Select Pokémon --" is chosen, repopulate with all dataset abilities/moves
            if (abilitySelect) populateSelectWithOptions(abilitySelect, DataService.getAbilitiesInDatasetLower(), 'Any Ability');
            moveSelects.forEach(select => populateSelectWithOptions(select, DataService.getMovesInDatasetLower(), 'Any Move'));
        } else {
            // Fetch and populate specific abilities
            const abilities = DataService.getAbilitiesForPokemon(selectedPokemonName);
            if (abilitySelect) populateSelectWithOptions(abilitySelect, abilities, 'Any Ability');

            // Fetch and populate specific moves
            const moves = DataService.getMovesForPokemon(selectedPokemonName);
            moveSelects.forEach(select => populateSelectWithOptions(select, moves, 'Any Move'));
        }
    }
});

// --- Event Listener for Delete All Button ---
deleteAllCriteriaBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to remove all criteria?')) { // Optional confirmation
        criteriaContainer.innerHTML = ''; // Clear the container
        updateDeleteAllButtonVisibility(); // Hide the button and show initial message
    }
});


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

let currentSearchResults = [];
let currentMainTeamIndex = -1;

// Function to gather the structured query from the UI (No changes needed here)
function buildQueryFromUI() {
    const criteria = [];
    const blocks = criteriaContainer.querySelectorAll('.criteria-block');

    blocks.forEach(block => {
        const type = block.dataset.type;
        const criterion = { type };

        if (type === 'pokemon') {
            const pokemonName = block.querySelector('.pokemon-select').value;
            if (pokemonName) {
                 criterion.pokemonName = pokemonName;
                 criterion.item = block.querySelector('.item-select').value || null;
                 criterion.ability = block.querySelector('.ability-select').value || null;
                 criterion.tera = block.querySelector('.tera-select').value || null;
                 criterion.move1 = block.querySelector('[data-field="move1"]').value || null;
                 criterion.move2 = block.querySelector('[data-field="move2"]').value || null;
                 criterion.move3 = block.querySelector('[data-field="move3"]').value || null;
                 criterion.move4 = block.querySelector('[data-field="move4"]').value || null;
                 criteria.push(criterion);
            }
        } else { // General criteria
            const value = block.querySelector('.value-select').value;
            if (value) {
                criterion.value = value;
                criteria.push(criterion);
            }
        }
    });
    return criteria;
}


// Function to trigger the search process (No changes needed here)
async function triggerSearch() {
    const queryCriteria = buildQueryFromUI();

    if (queryCriteria.length === 0) {
        teamTitle.textContent = 'Build a Query';
        teamContainer.innerHTML = `<div class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">Add criteria using the button above to start searching for teams.</div>`;
        copyAllBtn.classList.add('hidden');
        otherTeamsContainer.classList.add('hidden');
        return;
    }

    if (initialMessage) initialMessage.classList.add('hidden');
    searchText.textContent = "Searching";
    loadingSpinner.classList.remove("hidden");
    searchBtn.disabled = true;
    addCriteriaBtn.disabled = true;
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
        const teams = await window.generatePokepaste(queryCriteria);

        if (!teams || teams.length === 0) {
            teamTitle.textContent = 'No Results';
            teamContainer.innerHTML = `<div class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">No teams found matching your query. Try adjusting the criteria.</div>`;
            otherTeamsContainer.classList.add('hidden');
        } else {
             currentSearchResults = teams;
             currentMainTeamIndex = 0;
             updateMainTeamDisplay(currentSearchResults[currentMainTeamIndex]);
             if (currentSearchResults.length > 1) updateOtherTeamsDisplay();
             else otherTeamsContainer.classList.add('hidden');
        }

    } catch (error) {
        console.error("Error during search:", error);
        teamTitle.textContent = 'Error';
        teamContainer.innerHTML = `<div class="p-4 text-center text-red-500 dark:text-red-400 text-sm">An error occurred during the search. Please check the console. <br><span class="text-xs">${error.message}</span></div>`;
        copyAllBtn.classList.add('hidden');
        otherTeamsContainer.classList.add('hidden');
        currentSearchResults = [];
        currentMainTeamIndex = -1;
    } finally {
        searchText.textContent = "Search";
        loadingSpinner.classList.add("hidden");
        searchBtn.disabled = false;
        addCriteriaBtn.disabled = !isDataReady;
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
    container.innerHTML = ''; // Clear previous content

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
        if (!pokemon) return; // Skip if pokemon data is somehow null

        const row = document.createElement('div');
        // Ensure dark mode class toggling works correctly
        const isDarkMode = document.documentElement.classList.contains('dark');
        const altClass = index % 2 === 0
            ? (isDarkMode ? 'dark:bg-gray-800' : 'bg-white')
            : (isDarkMode ? 'dark:bg-excel-dark-alt' : 'bg-gray-50');
        row.className = `excel-row ${altClass}`;


        const itemName = pokemon.item && pokemon.item !== "None" ? pokemon.item : null;
        const itemSpriteUrl = itemName
            ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${itemName.toLowerCase().replace(/ /g, '-')}.png`
            : null;

        const teraType = pokemon.tera_type && pokemon.tera_type !== "None" ? pokemon.tera_type : "None";
        const teraClass = teraType !== "None" ? `type-${teraType.toLowerCase()}` : 'type-none';

        // Ensure moves array exists and pad with placeholders if necessary
        const moves = [...(pokemon.moves || [])];
        while (moves.length < 4) {
            moves.push({ name: '-', type: 'unknown' }); // Use object structure for consistency
        }

        // Item Cell HTML generation with fallback
        let itemCellHTML = `<span class="text-gray-400 dark:text-gray-500 italic text-xs">None</span>`;
        if (itemName) {
            // Basic sanitization for alt/title attributes
            const safeItemName = itemName.replace(/"/g, '"').replace(/'/g, '"');
            itemCellHTML = `
                <img src="${itemSpriteUrl}" alt="${safeItemName}" class="w-4 h-4 mr-1 inline-block object-contain"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"
                     onload="this.style.display='inline'; this.nextElementSibling.style.display='none';"
                     title="${safeItemName}">
                <span class="item-fallback-text" style="display:none;">${itemName /* Use original case here */}</span>
            `;
        }

        // Construct row innerHTML
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
                const displayType = moveType !== 'unknown' ? moveType.charAt(0).toUpperCase() + moveType.slice(1) : 'Unknown';
                const safeMoveName = moveName.replace(/"/g, '"').replace(/'/g, '"');

                return `
                <div class="excel-cell cell-move text-xs">
                    ${moveName !== '-' ? `
                        <span class="type-badge-excel type-${moveType} mr-1" title="${displayType} Type">${moveType.substring(0, 3).toUpperCase() || '?'}</span>
                        ${safeMoveName /* Use original case */}
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
        message.timeoutId = setTimeout(() => { message.classList.remove("visible"); message.timeoutId = null; }, 2000);
    }).catch(err => { console.error('Failed to copy team:', err); alert("Failed to copy team."); });
}

// --- Initial Setup ---
// Check if the initial message exists and show it if criteria container is empty
if (criteriaContainer.children.length === 0 && initialMessage) {
    initialMessage.classList.remove('hidden');
} else if (initialMessage) {
    initialMessage.classList.add('hidden');
}

updateDeleteAllButtonVisibility();
console.log("script.js loaded.");