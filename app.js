(function () {
  "use strict";

  // ===== DOM Elements =====
  const btnSingles = document.getElementById("btn-singles");
  const btnDoubles = document.getElementById("btn-doubles");
  const playerCountInput = document.getElementById("player-count");
  const courtCountInput = document.getElementById("court-count");
  const roundCountInput = document.getElementById("round-count");
  const nameInputsContainer = document.getElementById("name-inputs");
  const btnGenerate = document.getElementById("btn-generate");
  const errorMessage = document.getElementById("error-message");
  const resultSection = document.getElementById("result");
  const statsSummary = document.getElementById("stats-summary");
  const matchThead = document.getElementById("match-thead");
  const matchTbody = document.getElementById("match-tbody");

  let mode = "singles"; // "singles" | "doubles"
  let playerNames = []; // Store player names

  // ===== Toggle Mode =====
  btnSingles.addEventListener("click", () => {
    mode = "singles";
    btnSingles.classList.add("active");
    btnDoubles.classList.remove("active");
  });

  btnDoubles.addEventListener("click", () => {
    mode = "doubles";
    btnDoubles.classList.add("active");
    btnSingles.classList.remove("active");
  });

  // ===== Update Name Inputs on Player Count Change =====
  playerCountInput.addEventListener("input", updateNameInputs);

  function updateNameInputs() {
    const count = parseInt(playerCountInput.value, 10);
    if (isNaN(count) || count < 2 || count > 30) return;

    nameInputsContainer.innerHTML = "";

    for (let i = 0; i < count; i++) {
      const wrapper = document.createElement("div");
      wrapper.className = "name-input-wrapper";

      const label = document.createElement("label");
      label.textContent = `P${i + 1}`;
      label.setAttribute("for", `player-name-${i}`);

      const input = document.createElement("input");
      input.type = "text";
      input.id = `player-name-${i}`;
      input.placeholder = `${i + 1}`;
      input.maxLength = 20;
      input.value = playerNames[i] || "";

      wrapper.appendChild(label);
      wrapper.appendChild(input);
      nameInputsContainer.appendChild(wrapper);
    }
  }

  // Initialize name inputs on load
  updateNameInputs();

  // ===== Generate =====
  btnGenerate.addEventListener("click", generate);

  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.hidden = false;
    resultSection.hidden = true;
  }

  function clearError() {
    errorMessage.hidden = true;
  }

  function generate() {
    clearError();

    const playerCount = parseInt(playerCountInput.value, 10);
    const courtCount = parseInt(courtCountInput.value, 10);
    const roundCount = parseInt(roundCountInput.value, 10);

    // Collect player names
    playerNames = [];
    for (let i = 0; i < playerCount; i++) {
      const input = document.getElementById(`player-name-${i}`);
      const name = input ? input.value.trim() : "";
      playerNames.push(name || `${i + 1}`); // Default to number if empty
    }

    const playersPerMatch = mode === "singles" ? 2 : 4;
    const minPlayers = playersPerMatch;
    const playersPerRound = playersPerMatch * courtCount;

    // Validation
    if (isNaN(playerCount) || playerCount < 2 || playerCount > 30) {
      return showError("参加人数は2〜30の範囲で入力してください。");
    }
    if (isNaN(courtCount) || courtCount < 1 || courtCount > 10) {
      return showError("コート面数は1〜10の範囲で入力してください。");
    }
    if (isNaN(roundCount) || roundCount < 1 || roundCount > 50) {
      return showError("ラウンド数は1〜50の範囲で入力してください。");
    }
    if (playerCount < minPlayers) {
      return showError(
        `${mode === "singles" ? "シングルス" : "ダブルス"}には最低${minPlayers}人必要です。`
      );
    }
    if (playerCount < playersPerRound) {
      const maxCourts = Math.floor(playerCount / playersPerMatch);
      return showError(
        `${playerCount}人では最大${maxCourts}面までです。コート数を減らしてください。`
      );
    }

    // Generate rounds
    const rounds = generateRounds(playerCount, courtCount, roundCount, playersPerMatch);

    // Render
    renderTable(rounds, playerCount, courtCount, playersPerMatch);
    renderStats(rounds, playerCount);
    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ===== Core Algorithm =====
  // Greedy approach: for each round, pick players with the fewest appearances so far.
  // Among those, shuffle randomly to avoid deterministic patterns.
  // This ensures appearance counts stay as balanced as possible from top to bottom.

  function generateRounds(playerCount, courtCount, roundCount, playersPerMatch) {
    const players = Array.from({ length: playerCount }, (_, i) => i);
    const appearances = new Array(playerCount).fill(0);
    // Track pair counts for doubles to avoid repeating the same pair
    const pairCounts = mode === "doubles" ? new Map() : null;
    const rounds = [];

    for (let r = 0; r < roundCount; r++) {
      const playersNeeded = playersPerMatch * courtCount;

      // Sort players by appearances (ascending), break ties randomly
      const sorted = players
        .map((p) => ({ id: p, count: appearances[p], rand: Math.random() }))
        .sort((a, b) => a.count - b.count || a.rand - b.rand);

      const selected = sorted.slice(0, playersNeeded).map((p) => p.id);
      const resting = sorted.slice(playersNeeded).map((p) => p.id);

      // Assign to courts
      const courts = [];

      if (mode === "doubles" && pairCounts) {
        // For doubles, try to form balanced pairs
        const courtAssignments = assignDoublesBalanced(selected, courtCount, pairCounts);
        for (const court of courtAssignments) {
          courts.push(court);
        }
        // Update pair counts
        for (const court of courts) {
          const team1 = court.slice(0, 2);
          const team2 = court.slice(2, 4);
          incrementPair(pairCounts, team1[0], team1[1]);
          incrementPair(pairCounts, team2[0], team2[1]);
        }
      } else {
        // Shuffle selected for random matchups
        shuffle(selected);
        for (let c = 0; c < courtCount; c++) {
          const start = c * playersPerMatch;
          courts.push(selected.slice(start, start + playersPerMatch));
        }
      }

      // Update appearances
      for (const id of selected) {
        appearances[id]++;
      }

      rounds.push({ courts, resting });
    }

    return rounds;
  }

  function pairKey(a, b) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
  }

  function incrementPair(map, a, b) {
    const key = pairKey(a, b);
    map.set(key, (map.get(key) || 0) + 1);
  }

  function getPairCount(map, a, b) {
    return map.get(pairKey(a, b)) || 0;
  }

  function assignDoublesBalanced(selected, courtCount, pairCounts) {
    // Try to minimize repeated pairs within teams
    // Simple greedy: build teams one by one, picking the partner with lowest pair count
    const available = [...selected];
    shuffle(available);

    const teams = [];
    const used = new Set();

    // Form 2 * courtCount teams of 2
    const teamCount = courtCount * 2;

    for (let t = 0; t < teamCount; t++) {
      // Pick first available player
      let first = -1;
      for (const p of available) {
        if (!used.has(p)) {
          first = p;
          break;
        }
      }
      if (first === -1) break;
      used.add(first);

      // Pick partner with lowest pair count with first
      let bestPartner = -1;
      let bestScore = Infinity;
      const candidates = [];
      for (const p of available) {
        if (!used.has(p)) {
          candidates.push(p);
        }
      }
      shuffle(candidates);
      for (const p of candidates) {
        const score = getPairCount(pairCounts, first, p);
        if (score < bestScore) {
          bestScore = score;
          bestPartner = p;
        }
      }
      if (bestPartner === -1) break;
      used.add(bestPartner);

      teams.push([first, bestPartner]);
    }

    // Pair teams into courts
    const courts = [];
    for (let c = 0; c < courtCount; c++) {
      const t1 = teams[c * 2];
      const t2 = teams[c * 2 + 1];
      if (t1 && t2) {
        courts.push([...t1, ...t2]);
      }
    }

    return courts;
  }

  // ===== Rendering =====
  function playerLabel(id) {
    return playerNames[id] || String(id + 1);
  }

  function renderTable(rounds, playerCount, courtCount, playersPerMatch) {
    // Header
    let headerHTML = "<tr><th>R</th>";
    for (let c = 0; c < courtCount; c++) {
      headerHTML += `<th>コート ${c + 1}</th>`;
    }
    headerHTML += "<th>休み</th></tr>";
    matchThead.innerHTML = headerHTML;

    // Body
    let bodyHTML = "";
    for (let r = 0; r < rounds.length; r++) {
      const round = rounds[r];
      bodyHTML += `<tr><td class="round-cell">${r + 1}</td>`;

      for (const court of round.courts) {
        if (playersPerMatch === 2) {
          // Singles: P1 vs P2
          bodyHTML += `<td class="match-cell">${playerLabel(court[0])}<span class="vs">vs</span>${playerLabel(court[1])}</td>`;
        } else {
          // Doubles: P1・P2 vs P3・P4
          bodyHTML += `<td class="match-cell">${playerLabel(court[0])}・${playerLabel(court[1])}<span class="vs">vs</span>${playerLabel(court[2])}・${playerLabel(court[3])}</td>`;
        }
      }

      // Resting players
      if (round.resting.length > 0) {
        bodyHTML += `<td class="rest-cell">${round.resting.map(playerLabel).join(", ")}</td>`;
      } else {
        bodyHTML += `<td class="rest-cell">—</td>`;
      }

      bodyHTML += "</tr>";
    }
    matchTbody.innerHTML = bodyHTML;
  }

  function renderStats(rounds, playerCount) {
    const appearances = new Array(playerCount).fill(0);
    for (const round of rounds) {
      for (const court of round.courts) {
        for (const id of court) {
          appearances[id]++;
        }
      }
    }

    const min = Math.min(...appearances);
    const max = Math.max(...appearances);

    let html = `<span class="stat-item">全${rounds.length}ラウンド</span>`;
    html += `<span class="stat-item">出場回数: 最少 <span class="stat-count">${min}</span> / 最多 <span class="stat-count">${max}</span></span>`;
    html += `<span class="stat-item">偏差: <span class="stat-count">${max - min}</span></span>`;

    // Per-player breakdown
    html += "<br>";
    for (let i = 0; i < playerCount; i++) {
      html += `<span class="stat-item">P${playerLabel(i)}: <span class="stat-count">${appearances[i]}回</span></span>`;
    }

    statsSummary.innerHTML = html;
  }

  // ===== Utility =====
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
})();
