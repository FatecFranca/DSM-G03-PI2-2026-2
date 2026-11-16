const pages = [
  ["login", "Login", "login.html"],
  ["cadastro", "Cadastro", "cadastro.html"],
  ["inicio", "Início", "inicio.html"],
  ["mapa", "Mapa", "mapa.html"],
  ["estabelecimento", "Estabelecimento", "estabelecimento.html"],
  ["pagamento", "Pagamento", "pagamento.html"],
  ["perfil", "Perfil", "perfil.html"],
  ["avaliacao", "Avaliação", "avaliacao.html"],
  ["clube", "Clube", "clube.html"],
  ["flash", "Vaga Flash", "flash.html"],
  ["painel", "Painel", "painel.html"]
];

const currentPage = document.body.dataset.page;

const brand = `
  <div class="brand">
    <svg class="brand-icon" viewBox="0 0 200 200" aria-hidden="true">
      <rect width="200" height="200" rx="44" fill="#fff"/>
      <g transform="translate(40,35)">
        <path
          d="M60 10C95 10 118 45 100 82
             C88 106 60 120 60 120
             C60 120 32 106 20 82
             C2 45 25 10 60 10Z"
          fill="#E5383B"
        />
        <path
          d="M46 20V110M46 66L90 22M46 66L92 112"
          fill="none"
          stroke="#111"
          stroke-width="11"
          stroke-linecap="round"
        />
        <circle cx="46" cy="66" r="7.5" fill="#fff"/>
      </g>
    </svg>
    <div>
      <div class="wordmark">kal<em>i</em>x</div>
      <div class="tagline">ESTÉTICA &amp; AGENDA</div>
    </div>
  </div>
`;

const siteHeader = document.querySelector("[data-site-header]");

if (siteHeader) {
  siteHeader.innerHTML = `
    <div class="site-bar">
      <a class="site-name" href="inicio.html">kal<em>i</em>x</a>

      <nav class="site-links" aria-label="Páginas">
        ${pages.map(([id, label, href]) => `
          <a
            href="${href}"
            ${currentPage === id ? 'aria-current="page"' : ""}
          >${label}</a>
        `).join("")}
      </nav>
    </div>
  `;
}

document.querySelectorAll("[data-brand]").forEach(element => {
  element.innerHTML = brand;
});

document.querySelectorAll("[data-app-header]").forEach(element => {
  const title = element.dataset.appHeader;

  element.innerHTML = `
    ${brand}
    ${title
      ? `<span class="bold">${title}</span>`
      : '<span class="avatar">MS</span>'}
  `;
});

document.querySelectorAll("[data-bottom-nav]").forEach(element => {
  const active = element.dataset.bottomNav;

  /*
   * Não há uma tela de agenda independente no design fornecido.
   * "Agenda" leva à seleção visual de serviços e horários.
   */
  const navigation = [
    ["inicio", "Início", "⌂", "inicio.html"],
    ["mapa", "Mapa", "◎", "mapa.html"],
    ["agenda", "Agenda", "▦", "estabelecimento.html"],
    ["perfil", "Perfil", "♙", "perfil.html"]
  ];

  element.innerHTML = navigation.map(([id, label, icon, href]) => `
    <a
      href="${href}"
      class="${active === id ? "active" : ""}"
      ${active === id ? 'aria-current="page"' : ""}
    >
      <span class="nav-symbol" aria-hidden="true">${icon}</span>
      <span>${label}</span>
    </a>
  `).join("");
});
