function showSearchCards(results) {
    const footer = document.getElementById("searchFooter");
    const strip = document.getElementById("searchStrip");

    footer.style.display = "block";
    strip.innerHTML = "";

    results.forEach(item => {
        const card = document.createElement("div");
        card.className = "searchCard";
        card.innerHTML = `
            <div class="title">${item.title}</div>
            <div class="time">${item.time}</div>
            <div class="venue">${item.venue}</div>
            <div class="badge">${item.category}</div>
        `;
        strip.appendChild(card);
    });
}

function hideSearchCards() {
    document.getElementById("searchFooter").style.display = "none";
}