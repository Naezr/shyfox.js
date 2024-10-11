// ==UserScript==
// @name    Modern URL bar
// @description     Makes URL bar more modern
// ==/UserScript==

(function () {

  function getDomain(url) {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch (e) {
      return null;
    }
  }

  function appendLabel(id, htmlFor, parent) {
    let label = document.createElement("label");
    label.id = id;
    label.htmlFor = htmlFor;
    parent.appendChild(label);
    return label;
  }

  function main(window) {
    let doc = window.document;

    const urlbarInputBox = doc.querySelector(".urlbar-input-box");

    let shyUrlBox = appendLabel("shyUrlBox", "urlbar-input", urlbarInputBox);
    let shyLabelBox = appendLabel("shyLabelBox", "urlbar-input", urlbarInputBox);

    // update url and label
    function updateShyUrl() {
      let urlbarInput = doc.getElementById("urlbar-input");

      let label = window.gBrowser.selectedTab.linkedBrowser.contentTitle;
      shyLabelBox.textContent = label;

      let domain = getDomain(window.gURLBar._untrimmedValue);
      shyUrlBox.textContent = domain;

      if (domain === "") {
        shyUrlBox.setAttribute("empty", "");
      } else { shyUrlBox.removeAttribute("empty") }

      if (domain === null) {
        shyUrlBox.setAttribute("null", "");
        urlbarInput.removeAttribute("inactive");
        return;
      } else { shyUrlBox.removeAttribute("null") }

      urlbarInput.setAttribute("inactive", "");
    }

    // initial update
    updateShyUrl();

    // handle tab changes
    const observer = new MutationObserver(mutations => {
      mutations.forEach(() => {
        updateShyUrl();
      });
    });

    observer.observe(window.gBrowser.tabContainer, {
      childList: true,
      subtree: true,
      attributes: true
    });

    window.gURLBar.addEventListener("change", updateShyUrl);
  }

  // run
  UC_API.Windows.waitWindowLoading(window).then(window => {
    main(window);
  });

})();