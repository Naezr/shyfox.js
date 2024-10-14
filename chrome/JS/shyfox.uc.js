// ==UserScript==
// @name     ShyFox
// @description     ShyFox custom scripts
// ==/UserScript==

(function () {

  // array of existing containers
  const containers = ["sidebar", "topbar", "btmbar"];

  // array of existing panels
  const panels = ["navbar", "bmbar", "tabbar", "content"];

  // ids of existing panels
  const panelsIds = {
    navbar: "nav-bar",
    bmbar: "PersonalToolbar",
    tabbar: "TabsToolbar",
    content: "sidebar-content"
  }

  // valid panels for each container (keys must be identical to containers array)
  const validValues = {
    sidebar: ["navbar", "bmbar", "content"],
    topbar: ["tabbar", "navbar", "bmbar"],
    btmbar: ["tabbar", "navbar", "bmbar"]
  };

  // default panels state
  const defaultState = {
    sidebar: ["content"],
    topbar: ["tabbar", "navbar", "bmbar"],
    btmbar: [""]
  };

  try { // create clean cache & restart button
    UC_API.Utils.createWidget({
      id: "restart-button",
      type: "toolbarbutton",
      label: "Restart & clean cache",
      tooltip: "Restart and clear startup cache",
      image: "chrome://browser/skin/import.svg",
      callback: function () { UC_API.Runtime.restart(true); }
    });
  } catch (e) { }



  function appendDiv(doc, id, parent, child = null) {
    if (child === true) { child = parent.firstChild; }
    let div = doc.createElement("div");
    div.id = id;
    parent.insertBefore(div, child);
    return div
  }

  function waitCreating(window, id, callback) {
    new MutationObserver(function (mutationsList, observer) {
      for (let mutation of mutationsList) {
        if (mutation.addedNodes.length) {
          for (let node of mutation.addedNodes) {
            if (node.id === id) {
              callback();
              observer.disconnect();
              break;
            }
          }
        }
      }
    }).observe(window.document, { childList: true, subtree: true });
  }



  function main(window) {
    const doc = window.document;
    if (doc.documentElement.getAttribute("chromehidden") != "") return; // return if window is not full
    let loading = window.UC_API.Windows.waitWindowLoading(window);

    // append browser
    doc.getElementById("navigator-toolbox").appendChild(doc.getElementById("browser"));

    // append customization box when created
    waitCreating(window, "customization-container", function () {
      window.browser.appendChild(window.document.getElementById("customization-container"));
      sidebarPosition(UC_API.Prefs.get("sidebar.position_start").value);
    });

    // create containers
    createSidebar(doc, loading, window);
    createTopbar(doc, loading, window);
    createBottombar(doc, loading, window);

    // init panels
    initPanels(false, doc, loading, window);
    UC_API.Prefs.addListener("shyfox", (pref) => (initPanels(pref, doc, loading, window)));

    // insert notification deck when created
    waitCreating(window, "tab-notification-deck", function () {
      window.gNavToolbox.insertBefore(window.document.getElementById("tab-notification-deck"), window.browser);
    });
  }



  function initPanels(pref, doc, loading, window) {
    // remove duplicate panels if called by pref listener
    if (pref) panelsCfgRmDuplicate(pref);
    // remove invalid panels
    panelsCfgRmInvalid();
    // check if missing panels
    panelsCfgCheckMissing();

    // init
    initSidebar(doc, loading, window);
    initTopbar(doc, loading, window);
    initBottombar(doc, loading, window);
  }



  function panelsGetAllConfigs() {
    // return object containing all containers with their configs
    return Object.fromEntries(containers.map(container =>
      [container, UC_API.Prefs.get(`shyfox.${container}-config`).value.split(",")]));
  }

  function panelsSaveConfigs(configs) {
    // save settings from the received object
    Object.entries(configs).forEach(([container, panels]) => UC_API.Prefs.set(`shyfox.${container}-config`, panels.join(",")));
  }

  function panelsCfgRmInvalid() {
    // get all configs object
    let allConfigs = panelsGetAllConfigs(containers);
    // filter allConfigs to have only valid values
    let filteredConfigs = Object.fromEntries(Object.entries(allConfigs).map(([container, panels]) =>
      [container, panels.filter(panel => validValues[container].includes(panel))]));
    // save containers configs
    panelsSaveConfigs(filteredConfigs);
  }

  function panelsCfgRmDuplicate(pref) {
    // get array of panels for last modified container
    let changedConfig = pref.value.split(",");
    // get key from pref name of last modified container
    let changedPref = pref.name.replace(/shyfox\.(.*)-config/, "$1");
    // get all configs object
    let allConfigs = panelsGetAllConfigs(containers);
    // create object containing all containers with their configs except last modified container
    let otherConfigs = Object.fromEntries(Object.entries(allConfigs).filter(([key, value]) => key != changedPref));
    // remove panels added to the last container from the other containers
    Object.entries(otherConfigs).forEach(([key, value]) =>
      otherConfigs[key] = value.filter(panel => !changedConfig.includes(panel)));
    // save other containers configs
    panelsSaveConfigs(otherConfigs);
  }

  function panelsCfgCheckMissing() {
    // get all configs object
    let allConfigs = panelsGetAllConfigs(containers);
    // create Set of all panels present in all configs
    let allPanels = new Set(Object.values(allConfigs).flat());
    // create object to store missing panels by container
    let missingPanelsByContainer = {};
    // get missing panels for each container
    for (let panel of panels) if (!allPanels.has(panel)) {
      // get default container for panel
      let defaultContainer = Object.keys(defaultState).find(key => defaultState[key].includes(panel));
      // add this container to the missing panels object if needed
      if (!missingPanelsByContainer[defaultContainer]) missingPanelsByContainer[defaultContainer] = [];
      // filter missing panels for this container
      missingPanelsByContainer[defaultContainer] = defaultState[defaultContainer].filter(panel => !allPanels.has(panel));
    }
    // add missing panels to their default container
    for (let container in missingPanelsByContainer)
      allConfigs[container].push(...missingPanelsByContainer[container]);
    // save containers configs
    panelsSaveConfigs(allConfigs);
  }



  function createSidebar(doc, loading, window) {
    let sidebarContainerContainer = appendDiv(doc, "sidebar-container-container", window.browser, true);
    sidebarContainerContainer.classList.add("shyfox-container");
    let sidebarContainer = appendDiv(doc, "sidebar-container", sidebarContainerContainer);

    let splitter = appendDiv(doc, "sidebar-container-splitter", sidebarContainerContainer);
    loading.then(() => initSplitter(window, splitter, sidebarContainer));

    let sidebarContent = appendDiv(doc, "sidebar-content", sidebarContainer);
    sidebarContent.appendChild(doc.getElementById("sidebar-main"));
    sidebarContent.appendChild(doc.getElementById("sidebar-box"));
  }

  function initSidebar(doc, loading, window) {
    let sidebarContainer = doc.getElementById("sidebar-container");
    let sidebarContent = doc.getElementById("sidebar-content");

    let sidebarConfig = UC_API.Prefs.get("shyfox.sidebar-config").value.split(",").reverse();

    let navbar = doc.getElementById("nav-bar");
    let bmbar = doc.getElementById("PersonalToolbar");

    for (let panel of sidebarConfig) {
      if (panel === "navbar") {
        sidebarContainer.insertBefore(navbar, sidebarContainer.firstChild);
        loading.then(() => doCompactNavbar(doc));
      } else if (panel === "bmbar") {
        sidebarContainer.insertBefore(bmbar, sidebarContainer.firstChild);
      } else if (panel === "content") {
        sidebarContainer.insertBefore(sidebarContent, sidebarContainer.firstChild);
      }
    }

    // initial sidebar position
    loading.then(() => sidebarPosition(UC_API.Prefs.get("sidebar.position_start").value));

    // listen sidebar position
    UC_API.Prefs.addListener("sidebar.position_start", (obj, pref) => {
      sidebarPosition(obj.value);
    });
  }



  function createTopbar(doc, loading, window) {
    let topbarContainer = appendDiv(doc, "topbar-container", window.gNavToolbox, window.browser);
    topbarContainer.classList.add("shyfox-container");
  }

  function initTopbar(doc, loading, window) {
    let topbarContainer = doc.getElementById("topbar-container");

    let topbarConfig = UC_API.Prefs.get("shyfox.topbar-config").value.split(",");

    let tabbar = doc.getElementById("TabsToolbar");
    let navbar = doc.getElementById("nav-bar");
    let bmbar = doc.getElementById("PersonalToolbar");

    for (let panel of topbarConfig) {
      if (panel === "tabbar") {
        topbarContainer.appendChild(tabbar);
      } else if (panel === "navbar") {
        undoCompactNavbar(doc);
        topbarContainer.appendChild(navbar);
      } else if (panel === "bmbar") {
        topbarContainer.appendChild(bmbar);
      }
    }
  }



  function createBottombar(doc, loading, window) {
    let btmbarContainer = appendDiv(doc, "btmbar-container", window.gNavToolbox, window.browser.nextSibling);
    btmbarContainer.classList.add("shyfox-container");
  }

  function initBottombar(doc, loading, window) {
    let btmbarContainer = doc.getElementById("btmbar-container");

    let btmbarConfig = UC_API.Prefs.get("shyfox.btmbar-config").value.split(",");

    let tabbar = doc.getElementById("TabsToolbar");
    let navbar = doc.getElementById("nav-bar");
    let bmbar = doc.getElementById("PersonalToolbar");

    for (let panel of btmbarConfig) {
      if (panel === "tabbar") {
        btmbarContainer.appendChild(tabbar);
      } else if (panel === "navbar") {
        undoCompactNavbar(doc);
        btmbarContainer.appendChild(navbar);
      } else if (panel === "bmbar") {
        btmbarContainer.appendChild(bmbar);
      }
    }
  }



  function doCompactNavbar(doc) {
    if (doc.getElementById("navbar-container")) return;
    const navbar = doc.getElementById("nav-bar");
    let navbarContainer = appendDiv(doc, "navbar-container", navbar.parentNode, navbar.nextSibling);
    navbarContainer.appendChild(navbar);
    navbarContainer.appendChild(doc.getElementById("urlbar-container"));
  }

  function undoCompactNavbar(doc) {
    const navbar = doc.getElementById("nav-bar");
    const container = doc.getElementById("navbar-container");
    if (!container) return;

    let navBarList = JSON.parse(UC_API.Prefs.get("browser.uiCustomization.state").value).placements['nav-bar'];
    let index = navBarList.indexOf('urlbar-container');
    let nextElement = index === -1 || index === navBarList.length - 1 ? null : navBarList[index + 1];

    navbar._customizationTarget.insertBefore(doc.getElementById("urlbar-container"), doc.getElementById(nextElement));
    container.parentNode.insertBefore(navbar, container);
    container.remove();
  }



  // handle sidebar position (true = left, false = right)
  function sidebarPosition(value) {
    UC_API.Windows.forEach((doc, window) => {
      if (doc.documentElement.getAttribute("chromehidden") != "") return; // return if window is not full
      function $(id) { return doc.getElementById(id) }
      if (value) {
        $("sidebar-container-container").style.order = "1";
        $("sidebar-container-container").removeAttribute("positionend");
        $("tabbrowser-tabbox").style.order = "2";
        if ($("customization-container")) $("customization-container").style.order = "2";
        $("sidebar-container").style.order = "1";
        $("sidebar-container-splitter").style.order = "2";
        $("sidebar-container-splitter").removeAttribute("revert");
        $("sidebar-main").style.order = "1";
        $("sidebar-box").style.order = "2";
      } else {
        $("sidebar-container-container").style.order = "2";
        $("sidebar-container-container").setAttribute("positionend", "");
        $("tabbrowser-tabbox").style.order = "1";
        if ($("customization-container")) $("customization-container").style.order = "1";
        $("sidebar-container").style.order = "2";
        $("sidebar-container-splitter").style.order = "1";
        $("sidebar-container-splitter").setAttribute("revert", "");
        $("sidebar-main").style.order = "2";
        $("sidebar-box").style.order = "1";
      }
    }, true)
  }



  // not made to be reusable, but only for sidebar-container-splitter
  function initSplitter(window, splitter, splitterTarget) {
    const doc = window.document;
    const docElStyle = doc.documentElement.style;

    let width = UC_API.Prefs.get("sidebar-container.width").value; // get saved sidebar width
    let isDragging = false;
    let initialX;
    let initialWidth;
    const minWidth = parseInt(getComputedStyle(splitterTarget).minWidth, 10);
    const maxWidth = parseInt(getComputedStyle(splitterTarget).maxWidth, 10);

    setSidebarWidth(width); // initial width set

    function setSidebarWidth(width) {
      splitterTarget.style.width = width + "px";
      splitterTarget.parentNode.style.setProperty("--sidebar-width", width + "px");
    }

    splitter.addEventListener("mousedown", (e) => {
      isDragging = true;
      docElStyle.setProperty("pointer-events", "none"); // prevent flickering
      docElStyle.setProperty("cursor", "ew-resize");
      splitter.setAttribute("dragging", "");
      splitter.parentNode.setAttribute("dragging", "");
      initialX = e.clientX;
      initialWidth = splitterTarget.offsetWidth;
    });

    doc.documentElement.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const newWidth = initialWidth + (e.clientX - initialX) * (splitter.hasAttribute("revert") ? -1 : 1);
      if (newWidth < minWidth) return;
      if (newWidth > maxWidth) return;
      width = Math.min(Math.max(newWidth, minWidth), maxWidth);
      setSidebarWidth(width);
    });

    doc.documentElement.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      splitter.removeAttribute("dragging");
      splitter.parentNode.removeAttribute("dragging");
      docElStyle.removeProperty("pointer-events"); // undo prevent flickering
      docElStyle.removeProperty("cursor");
      UC_API.Prefs.set("sidebar-container.width", width); // save sidebar width
      if (doc.documentElement.getAttribute("customizing") === null) { // only if not in customization
        CustomizableUI.dispatchToolboxEvent("aftercustomization", {}, window); // check navbar for overflow
      }
    });
  }



  // run
  main(window);
})();