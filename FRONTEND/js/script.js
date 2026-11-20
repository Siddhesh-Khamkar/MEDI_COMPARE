/* ========================================
   MEDCOMPARE - FULL FRONTEND SCRIPT
   Database Search + Price Comparison + AI
======================================== */

document.addEventListener("DOMContentLoaded", () => {
    // ========================================
    // 1. CONFIGURATION
    // ========================================

    const API_URL = "http://127.0.0.1:8000";

    const $ = (id) => document.getElementById(id);
    const isDashboard = Boolean($("logoutBtn"));

    // Authentication elements
    const loginBtn = $("loginBtn");
    const signupBtn = $("signupBtn");
    const authModal = $("authModal");
    const closeAuthBtn = $("closeAuthBtn");
    const loginTab = $("loginTab");
    const signupTab = $("signupTab");
    const authForm = $("authForm");
    const authTitle = $("authTitle");
    const authSubtitle = $("authSubtitle");
    const authSubmit = $("authSubmit");
    const authMessage = $("authMessage");
    const authName = $("authName");
    const nameLabel = $("nameLabel");
    const authPassword = $("authPassword");
    const authEmail = $("authEmail");

    // Navigation
    const menuToggle = $("menuToggle");
    const navLinks = $("navLinks");

    // Medicine search
    const searchForm = $("medicineSearchForm");
    const medicineSearch = $("medicineSearch");
    const comparisonStatus = $("comparisonStatus");
    const comparisonSection = $("price-comparison");
    const openChatBtn = $("openChatBtn");

    // Chart and summary
    const chartType = $("chartType");
    const priceChartCanvas = $("priceChart");
    const chartFallback = $("chartFallback");
    const lowestPrice = $("lowestPrice");
    const highestPrice = $("highestPrice");
    const lowestMedicine = $("lowestMedicine");
    const highestMedicine = $("highestMedicine");
    const priceDifference = $("priceDifference");
    const priceInsight = $("priceInsight");

    // Create a results container if HTML doesn't already have one.
    let resultsPanel = $("medicineResults");

    if (!isDashboard && !resultsPanel && searchForm) {
        resultsPanel = document.createElement("div");
        resultsPanel.id = "medicineResults";
        resultsPanel.style.marginTop = "20px";

        searchForm.insertAdjacentElement("afterend", resultsPanel);
    }

    let isSignupMode = false;
    let previousFocusedElement = null;
    let currentMedicines = [];
    let priceChart = null;

    // ========================================
    // 2. HELPER FUNCTIONS
    // ========================================

    function formatPrice(value) {
        const amount = Number(value);

        if (!Number.isFinite(amount)) {
            return "Not available";
        }

        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    async function readResponse(response) {
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            let message = "";

            if (Array.isArray(result.detail)) {
                message = result.detail
                    .map((item) => item.msg || JSON.stringify(item))
                    .join(", ");
            } else if (typeof result.detail === "string") {
                message = result.detail;
            }

            throw new Error(
                message || `Request failed with status ${response.status}.`
            );
        }

        return result;
    }

    // ========================================
    // 3. LOGIN / SIGN-UP MODAL
    // ========================================

    function openAuthModal(signup = false) {
        if (!authModal) return;

        previousFocusedElement = document.activeElement;
        authModal.hidden = false;
        document.body.classList.add("modal-open");

        setAuthMode(signup);

        window.setTimeout(() => {
            const firstInput = signup ? authName : authEmail;
            firstInput?.focus();
        }, 50);
    }

    function closeAuthModal() {
        if (!authModal) return;

        authModal.hidden = true;
        document.body.classList.remove("modal-open");

        if (authMessage) {
            authMessage.textContent = "";
        }

        previousFocusedElement?.focus();
    }

    function setAuthMode(signup) {
        isSignupMode = signup;

        if (authTitle) {
            authTitle.textContent = signup
                ? "Create your account"
                : "Welcome back";
        }

        if (authSubtitle) {
            authSubtitle.textContent = signup
                ? "Sign up to get started with MedCompare."
                : "Log in to your MedCompare account.";
        }

        if (authSubmit) {
            authSubmit.textContent = signup
                ? "Create Account"
                : "Log In";
        }

        if (authName) {
            authName.hidden = !signup;
            authName.required = signup;
        }

        if (nameLabel) {
            nameLabel.hidden = !signup;
        }

        if (authPassword) {
            authPassword.autocomplete = signup
                ? "new-password"
                : "current-password";
        }

        loginTab?.classList.toggle("active", !signup);
        signupTab?.classList.toggle("active", signup);

        if (authMessage) {
            authMessage.textContent = "";
        }
    }

    loginBtn?.addEventListener("click", () => openAuthModal(false));
    signupBtn?.addEventListener("click", () => openAuthModal(true));

    // Open login modal when dashboard redirects an unauthenticated visitor here.
    if (
        !isDashboard &&
        new URLSearchParams(window.location.search).get("login") === "1"
    ) {
        openAuthModal(false);
    }

    closeAuthBtn?.addEventListener("click", closeAuthModal);

    loginTab?.addEventListener("click", () => setAuthMode(false));
    signupTab?.addEventListener("click", () => setAuthMode(true));

    authModal?.addEventListener("click", (event) => {
        if (event.target === authModal) {
            closeAuthModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && authModal && !authModal.hidden) {
            closeAuthModal();
        }
    });

    authForm?.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!authForm.reportValidity()) return;

        const name = authName?.value.trim() || "";
        const email = authEmail?.value.trim() || "";
        const password = authPassword?.value || "";

        if (isSignupMode && name.length < 2) {
            if (authMessage) {
                authMessage.textContent =
                    "Name must contain at least 2 characters.";
                authMessage.style.color = "red";
            }
            return;
        }

        if (isSignupMode && password.length < 8) {
            if (authMessage) {
                authMessage.textContent =
                    "Password must contain at least 8 characters.";
                authMessage.style.color = "red";
            }
            return;
        }

        if (authSubmit) {
            authSubmit.disabled = true;
            authSubmit.textContent = isSignupMode
                ? "Creating account..."
                : "Logging in...";
        }

        if (authMessage) {
            authMessage.textContent = "Connecting to server...";
            authMessage.style.color = "#555";
        }

        try {
            const endpoint = isSignupMode
                ? "/auth/signup"
                : "/auth/login";

            const requestBody = isSignupMode
                ? { name, email, password }
                : { email, password };

            const response = await fetch(`${API_URL}${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            });

            const result = await readResponse(response);

            if (isSignupMode) {
                authForm.reset();
                setAuthMode(false);

                if (authMessage) {
                    authMessage.textContent =
                        "Account created! You can now log in.";
                    authMessage.style.color = "green";
                }
            } else {
                sessionStorage.setItem(
                    "medcompareUserName",
                    result.name || email
                );

                sessionStorage.setItem("medcompareLoggedIn", "true");

                window.location.href = "dashboard.html";
            }
        } catch (error) {
            if (authMessage) {
                authMessage.textContent =
                    error instanceof TypeError
                        ? "Cannot connect to the server. Check that the backend is running."
                        : error.message;

                authMessage.style.color = "red";
            }

            console.error("Authentication error:", error);
        } finally {
            if (authSubmit) {
                authSubmit.disabled = false;
                authSubmit.textContent = isSignupMode
                    ? "Create Account"
                    : "Log In";
            }
        }
    });

    // ========================================
    // 4. MOBILE NAVIGATION
    // ========================================

    menuToggle?.addEventListener("click", () => {
        const isOpen = navLinks?.classList.toggle("open") ?? false;

        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.textContent = isOpen ? "×" : "☰";
    });

    navLinks?.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("open");
            menuToggle?.setAttribute("aria-expanded", "false");

            if (menuToggle) {
                menuToggle.textContent = "☰";
            }
        });
    });

    // Highlight current navigation section.
    const navItems = navLinks
        ? Array.from(navLinks.querySelectorAll(".nav-link"))
        : [];

    const pageSections = navItems
        .map((link) => document.querySelector(link.getAttribute("href")))
        .filter(Boolean);

    if ("IntersectionObserver" in window) {
        const sectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;

                    navItems.forEach((link) => {
                        link.classList.toggle(
                            "active",
                            link.getAttribute("href") === `#${entry.target.id}`
                        );
                    });
                });
            },
            { rootMargin: "-25% 0px -60% 0px" }
        );

        pageSections.forEach((section) => {
            sectionObserver.observe(section);
        });
    }

    // ========================================
    // 5. CHART FALLBACK
    // ========================================

    function showChartFallback(message) {
        if (chartFallback) {
            chartFallback.textContent = message;
            chartFallback.style.display = "block";
        }

        if (priceChartCanvas) {
            priceChartCanvas.style.display = "none";
        }
    }

    function hideChartFallback() {
        if (chartFallback) {
            chartFallback.style.display = "none";
        }

        if (priceChartCanvas) {
            priceChartCanvas.style.display = "block";
        }
    }

    // ========================================
    // 6. PRICE SUMMARY
    // ========================================

    function updatePriceSummary(medicines) {
        if (!medicines.length) {
            if (lowestPrice) lowestPrice.textContent = "—";
            if (highestPrice) highestPrice.textContent = "—";
            if (lowestMedicine) lowestMedicine.textContent = "No results";
            if (highestMedicine) highestMedicine.textContent = "No results";
            if (priceDifference) priceDifference.textContent = "—";

            if (priceInsight) {
                priceInsight.textContent =
                    "Search for a medicine to see its price comparison.";
            }

            return;
        }

        const sorted = [...medicines].sort((a, b) => a.price - b.price);
        const cheapest = sorted[0];
        const mostExpensive = sorted[sorted.length - 1];
        const difference = mostExpensive.price - cheapest.price;

        if (lowestPrice) {
            lowestPrice.textContent = formatPrice(cheapest.price);
        }

        if (highestPrice) {
            highestPrice.textContent = formatPrice(mostExpensive.price);
        }

        if (lowestMedicine) {
            lowestMedicine.textContent = cheapest.name;
        }

        if (highestMedicine) {
            highestMedicine.textContent = mostExpensive.name;
        }

        if (priceDifference) {
            priceDifference.textContent = formatPrice(difference);
        }

        if (priceInsight) {
            priceInsight.textContent =
                `${cheapest.name} has the lowest listed dataset price at ` +
                `${formatPrice(cheapest.price)}. The difference between the ` +
                `lowest and highest listed prices is ${formatPrice(difference)}. ` +
                `Dataset prices may not represent current market prices.`;
        }
    }

    // ========================================
    // 7. PRICE CHART
    // ========================================

    function renderPriceChart(medicines) {
        if (!priceChartCanvas) return;

        if (!medicines.length) {
            if (priceChart) {
                priceChart.destroy();
                priceChart = null;
            }

            showChartFallback("Search for a medicine to display its price chart.");
            return;
        }

        if (!window.Chart) {
            showChartFallback(
                "Chart library is unavailable. Check your internet connection."
            );
            return;
        }

        hideChartFallback();

        if (priceChart) {
            priceChart.destroy();
            priceChart = null;
        }

        const selectedType = chartType?.value || "bar";

        const chartColors = [
            "#087f68",
            "#8b78d6",
            "#e8a363",
            "#4d9bc2",
            "#d87587",
            "#8cae75"
        ];

        priceChart = new window.Chart(priceChartCanvas, {
            type: selectedType,
            data: {
                labels: medicines.map((medicine) => medicine.name),
                datasets: [{
                    label: "Dataset price (₹)",
                    data: medicines.map((medicine) => medicine.price),
                    backgroundColor: medicines.map(
                        (_, index) => chartColors[index % chartColors.length]
                    ),
                    borderColor: "#ffffff",
                    borderWidth: 2,
                    borderRadius: selectedType === "bar" ? 7 : 0,
                    hoverOffset: selectedType === "doughnut" ? 8 : 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: selectedType === "doughnut",
                        position: "bottom"
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value =
                                    context.parsed.y ?? context.parsed;

                                return `Dataset price: ${formatPrice(value)}`;
                            }
                        }
                    }
                },
                scales: selectedType === "bar"
                    ? {
                        x: {
                            grid: { display: false }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => `₹${value}`
                            }
                        }
                    }
                    : {}
            }
        });
    }

        // ========================================
    // 8. RENDER MEDICINE RESULTS
    // ========================================

    function renderMedicineTable(medicines) {
        if (!resultsPanel) return;

        if (!medicines.length) {
            resultsPanel.innerHTML = "";
            return;
        }

        resultsPanel.innerHTML = `
            <div class="medicine-results">
                <h3>Medicine Price Comparison</h3>

                <p>
                    Prices are from the dataset and may not be current retail prices.
                </p>

                <div style="overflow-x:auto">
                    <table style="width:100%;border-collapse:collapse">
                        <thead>
                            <tr>
                                <th style="text-align:left;padding:10px">Medicine</th>
                                <th style="text-align:left;padding:10px">Composition</th>
                                <th style="text-align:left;padding:10px">Manufacturer</th>
                                <th style="text-align:right;padding:10px">Dataset Price</th>
                                <th style="text-align:center;padding:10px">AI Prediction</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${medicines.map((medicine, index) => `
                                <tr>
                                    <td style="padding:10px;border-top:1px solid #e0ebe4">
                                        ${escapeHtml(medicine.name)}
                                        ${index === 0
                                            ? '<strong style="display:block;color:#087f68;font-size:12px">Lowest listed price</strong>'
                                            : ""}
                                    </td>

                                    <td style="padding:10px;border-top:1px solid #e0ebe4">
                                        ${escapeHtml(medicine.salt_composition || "—")}
                                    </td>

                                    <td style="padding:10px;border-top:1px solid #e0ebe4">
                                        ${escapeHtml(medicine.company || "—")}
                                    </td>

                                    <td style="padding:10px;text-align:right;border-top:1px solid #e0ebe4">
                                        ${formatPrice(medicine.price)}
                                    </td>

                                    <td style="padding:10px;text-align:center;border-top:1px solid #e0ebe4">
                                        <button
                                            type="button"
                                            class="predict-price-btn"
                                            data-medicine-index="${index}">
                                            Predict Price
                                        </button>
                                    </td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>

                <div
                    id="aiPredictionResult"
                    style="margin-top:16px"
                    aria-live="polite">
                </div>

                <p style="font-size:12px;color:#637469;line-height:1.6">
                    AI estimates are not verified current market prices.
                    Do not change medicines based only on price. Confirm the
                    active ingredient, strength and formulation with a pharmacist
                    or qualified healthcare professional.
                </p>
            </div>
        `;

        resultsPanel.querySelectorAll(".predict-price-btn").forEach((button) => {
            button.addEventListener("click", async () => {
                const index = Number(button.dataset.medicineIndex);
                const medicine = medicines[index];

                if (!medicine) return;

                const predictionResult = $("aiPredictionResult");

                if (predictionResult) {
                    predictionResult.textContent =
                        `Predicting price for ${medicine.name}...`;
                }

                button.disabled = true;
                button.textContent = "Predicting...";

                try {
                    const response = await fetch(`${API_URL}/ai/predict-price`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            product_name: medicine.name,
                            salt_composition: medicine.salt_composition || "",
                            sub_category: medicine.sub_category || "",
                            product_manufactured: medicine.company || "",
                            current_price: medicine.price
                        })
                    });

                    const result = await readResponse(response);

                    const predictedPrice = Number(
                        result.predicted_price ??
                        result.predictedPrice ??
                        result.price
                    );

                    if (!Number.isFinite(predictedPrice)) {
                        throw new Error(
                            "The API response did not contain a valid predicted price."
                        );
                    }

                    if (predictionResult) {
                        predictionResult.innerHTML = `
                            <div style="padding:16px;border-radius:12px;background:#eef8f2">
                                <h4 style="margin-top:0">
                                    AI Price Prediction
                                </h4>

                                <p>
                                    <strong>Medicine:</strong>
                                    ${escapeHtml(medicine.name)}
                                </p>

                                <p>
                                    <strong>Dataset price:</strong>
                                    ${formatPrice(medicine.price)}
                                </p>

                                <p>
                                    <strong>Predicted price:</strong>
                                    ${formatPrice(predictedPrice)}
                                </p>

                                <p style="font-size:12px;color:#637469">
                                    This is a model estimate, not a verified
                                    current selling price.
                                </p>
                            </div>
                        `;
                    }
                } catch (error) {
                    if (predictionResult) {
                        predictionResult.textContent =
                            `Prediction failed: ${error.message}`;
                    }

                    console.error("AI prediction error:", error);
                } finally {
                    button.disabled = false;
                    button.textContent = "Predict Price";
                }
            });
        });
    }

    // ========================================
    // 9. SEARCH STATUS AND COMPARISON HELPERS
    // ========================================

    function showComparisonSection() {
        if (comparisonSection) {
            comparisonSection.hidden = false;
            comparisonSection.style.display = "";
        }
    }

    function hideComparisonSection() {
        if (comparisonSection) {
            comparisonSection.hidden = true;
        }
    }

    function normalizeMedicineResult(item) {
        return {
            id: item.id,
            name: item.product_name || item.name || "Unknown medicine",
            company: item.manufacturer || item.product_manufactured || "",
            price: Number(item.price),
            salt_composition: item.salt_composition || "",
            sub_category: item.sub_category || ""
        };
    }

    // ========================================
    // 10. REAL MEDICINE SEARCH
    // ========================================

    // The dashboard has its own search and native canvas chart handlers.
    // Keep this API search handler for index.html only.
    if (!isDashboard) {
        searchForm?.addEventListener("submit", async (event) => {
            event.preventDefault();

            const query = medicineSearch?.value.trim();

            if (!query) {
                medicineSearch?.focus();
                return;
            }

            if (comparisonStatus) {
                comparisonStatus.textContent =
                    `Searching database for "${query}"...`;
            }

            if (resultsPanel) {
                resultsPanel.textContent = "Searching medicine database...";
            }

            showChartFallback("Loading medicine prices...");

            try {
                const url =
                    `${API_URL}/medicines/compare?q=${encodeURIComponent(query)}&limit=20`;

                const response = await fetch(url);
                const result = await readResponse(response);

                const medicines = (result.results || []).map((item) => ({
                    id: item.id,
                    name: item.product_name,
                    company: item.manufacturer || "",
                    price: Number(item.price),
                    salt_composition: item.salt_composition || "",
                    sub_category: item.sub_category || ""
                })).filter((item) =>
                    item.name && Number.isFinite(item.price)
                );

                currentMedicines = medicines;

                if (!medicines.length) {
                    if (comparisonStatus) {
                        comparisonStatus.textContent =
                            `No database results for "${query}".`;
                    }

                    if (resultsPanel) {
                        resultsPanel.textContent =
                            `No medicines found for "${query}". Try another medicine name or active ingredient.`;
                    }

                    updatePriceSummary([]);
                    renderPriceChart([]);
                } else {
                    // Sort by dataset price, cheapest first.
                    medicines.sort((a, b) => a.price - b.price);

                    if (comparisonStatus) {
                        comparisonStatus.textContent =
                            `Found ${medicines.length} medicine results for "${query}".`;
                    }

                    renderMedicineTable(medicines);
                    updatePriceSummary(medicines);
                    renderPriceChart(medicines);
                    showComparisonSection();
                }
            } catch (error) {
                console.error("Medicine search error:", error);

                if (comparisonStatus) {
                    comparisonStatus.textContent =
                        "Unable to search the medicine database.";
                }

                if (resultsPanel) {
                    resultsPanel.textContent =
                        `Search failed: ${error.message}. Make sure the backend server is running.`;
                }

                updatePriceSummary([]);
                renderPriceChart([]);
            }
        });
    }

        // ========================================
    // 11. CHANGE CHART TYPE
    // ========================================

    // Dashboard has its own chart handler.
    // This handler is only for index.html.
    if (!isDashboard) {
        chartType?.addEventListener("change", () => {
            renderPriceChart(currentMedicines);
        });
    }

    // ========================================
    // 12. AI ASSISTANT BUTTON
    // ========================================

    openChatBtn?.addEventListener("click", () => {
        if (medicineSearch) {
            medicineSearch.focus();

            medicineSearch.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    });

    // ========================================
    // 13. INITIAL PAGE STATE
    // ========================================

    // Set the initial state only on index.html.
    if (!isDashboard) {
        if (comparisonStatus) {
            comparisonStatus.textContent =
                "Search for a medicine to compare database prices.";
        }

        updatePriceSummary([]);

        showChartFallback(
            "Search for a medicine to load its price comparison chart."
        );
    }
});