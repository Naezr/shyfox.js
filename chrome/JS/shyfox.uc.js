// ==UserScript==
// @name     ShyFox
// @description     ShyFox custom scripts
// ==/UserScript==

// create fast restart button 

(function () {

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

  try { // create clean cache & restart button
    UC_API.Utils.createWidget({
      id: "navbar-toggle-button",
      type: "toolbarbutton",
      label: "Navbar",
      image: "chrome://browser/skin/import.svg",
      callback: function () { toggleNavbar(window.document); }
    });
  } catch (e) { }



  function appendDiv(doc, id, parent, firstChild = false) {
    let div = doc.createElement("div");
    div.id = id;
    parent.insertBefore(div, firstChild ? parent.firstChild : null);
    return div
  }



  function main(window) {
    const doc = window.document;
    if (doc.documentElement.getAttribute("chromehidden") != "") return; // return if window is not full

    let loading = window.UC_API.Windows.waitWindowLoading(window);

    // append browser
    doc.getElementById("navigator-toolbox").appendChild(doc.getElementById("browser"));

    // append customization box when created
    new MutationObserver(function (mutationsList, observer) {
      for (let mutation of mutationsList) {
        if (mutation.addedNodes.length) {
          for (let node of mutation.addedNodes) {
            if (node.id === "customization-container") {
              browser.appendChild(node);
              sidebarPosition(UC_API.Prefs.get("sidebar.position_start").value);
              observer.disconnect();
              console.log("customization moved");
              break;
            }
          }
        }
      }
    }).observe(doc, { childList: true, subtree: true });

    initSidebar(window);
  }



  function initSidebar(window) {
    // create sidebar
    let sidebarContainerContainer = appendDiv(doc, "sidebar-container-container", browser, true);
    let sidebarContainer = appendDiv(doc, "sidebar-container", sidebarContainerContainer);

    let splitter = appendDiv(doc, "sidebar-container-splitter", sidebarContainerContainer);
    loading.then(() => initSplitter(window, splitter, sidebarContainer));

    let sidebarContent = appendDiv(doc, "sidebar-content", sidebarContainer);
    sidebarContent.appendChild(doc.getElementById("sidebar-main"));
    sidebarContent.appendChild(doc.getElementById("sidebar-box"));


    // add bookmarks bar to sidebar
    let bmbar = doc.getElementById("PersonalToolbar");
    sidebarContainer.insertBefore(bmbar, sidebarContainer.firstChild);

    // add navbar to sidebar
    let navbar = doc.getElementById("nav-bar");
    sidebarContainer.insertBefore(navbar, sidebarContainer.firstChild);
    loading.then(() => doCompactNavbar(doc));

    // initial sidebar position
    loading.then(() => sidebarPosition(UC_API.Prefs.get("sidebar.position_start").value));

    // listen sidebar position
    UC_API.Prefs.addListener("sidebar.position_start", (obj, pref) => {
      sidebarPosition(obj.value);
    });
  }



  function toggleNavbar(doc) {
    if (!doc.getElementById("navbar-container")) {
      doCompactNavbar(doc);
    } else { undoCompactNavbar(doc); }
  }

  function doCompactNavbar(doc) {
    if (doc.getElementById("navbar-container")) return;
    const navbar = doc.getElementById("nav-bar");
    let navbarContainer = appendDiv(doc, "navbar-container", navbar.parentNode, true);
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