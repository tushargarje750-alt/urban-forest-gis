
// Create an OpenLayers map

var map = new ol.Map({
  target: "map",
  view: new ol.View({
    projection: "EPSG:3857",
  }),
});

// Function to fetch and display tree data
var treesLayer; // Define treesLayer in the global scope

// Global variables for the layers
var geoServerLayer, chmLayer, mgrviLayer;

function updateMapLayers() {
  const selectedProjectName = document.getElementById("projectSelection").value;

  if (!selectedProjectName) {
    return; // No project selected
  }

  // Define layer names based on the selected project
  const orthoLayerName = `${selectedProjectName}_ortho`;
  const chmLayerName = `${selectedProjectName}_colored`;
  const mgrviLayerName = `${selectedProjectName}_mgrvi`;
  while (map.getLayers().getLength() > 0) {
    map.getLayers().removeAt(0); // Remove the first layer repeatedly until all are removed
  }
  // GeoServer layer for ortho
  geoServerLayer = new ol.layer.Tile({
    source: new ol.source.TileWMS({
      url: "http://localhost:8080/geoserver/Sharanga/wms",
      params: {
        LAYERS: `Sharanga:${orthoLayerName}`,
        FORMAT: "image/png",
        VERSION: "1.1.0",
      },
      serverType: "geoserver",
      transition: 0,
    }),
  });

  // CHM layer
  chmLayer = new ol.layer.Tile({
    source: new ol.source.TileWMS({
      url: "http://localhost:8080/geoserver/Sharanga/wms",
      params: {
        LAYERS: `Sharanga:${chmLayerName}`,
        FORMAT: "image/png",
        VERSION: "1.1.0",
      },
      serverType: "geoserver",
      transition: 0,
    }),
    visible: false,
  });

  // MGRVI layer
  mgrviLayer = new ol.layer.Tile({
    source: new ol.source.TileWMS({
      url: "http://localhost:8080/geoserver/Sharanga/wms",
      params: {
        LAYERS: `Sharanga:${mgrviLayerName}`,
        FORMAT: "image/png",
        VERSION: "1.1.0",
      },
      serverType: "geoserver",
      transition: 0,
    }),
    visible: false,
  });

  // Clear existing layers
  map.getLayers().clear();

  // Add the new layers to the map
  map.addLayer(geoServerLayer);
  map.addLayer(chmLayer);
  map.addLayer(mgrviLayer);
  const projectName = document.getElementById("projectSelection").value;
  fetchAndDisplayTreeData(projectName);
}

document.addEventListener("DOMContentLoaded", function () {
  fetchProjectNames(); // This function will populate the dropdown and should also call `updateMapLayers` initially if needed
});

// Make sure to attach the event listener to the project selection dropdown to call updateMapLayers when the selection changes
document
  .getElementById("projectSelection")
  .addEventListener("change", function () {
    updateMapLayers(); // This should now automatically handle fetching and displaying tree data for the selected project.
  });
// Checkbox and slider for CHM Data Layer
document.getElementById("chmCheckbox").addEventListener("change", function () {
  chmLayer.setVisible(this.checked);
});

document.getElementById("chmOpacity").addEventListener("input", function () {
  chmLayer.setOpacity(parseFloat(this.value));
});

// Checkbox and slider for Health Data Layer
document
  .getElementById("healthCheckbox")
  .addEventListener("change", function () {
    mgrviLayer.setVisible(this.checked);
  });

document.getElementById("healthOpacity").addEventListener("input", function () {
  mgrviLayer.setOpacity(parseFloat(this.value));
});

// Ensure the visibility of the layers aligns with the checkboxes on load
window.addEventListener("load", function () {
  // Set CHM layer visibility and opacity based on checkbox and slider value
  var chmCheckbox = document.getElementById("chmCheckbox");
  var chmOpacity = document.getElementById("chmOpacity");
  chmLayer.setVisible(chmCheckbox.checked);
  chmLayer.setOpacity(parseFloat(chmOpacity.value));

  // Set Health layer visibility and opacity based on checkbox and slider value
  var healthCheckbox = document.getElementById("healthCheckbox");
  var healthOpacity = document.getElementById("healthOpacity");
  mgrviLayer.setVisible(healthCheckbox.checked);
  mgrviLayer.setOpacity(parseFloat(healthOpacity.value));
});

var layerUpdateInProgress = false;

function fetchAndDisplayTreeData(
  projectName,
  minHeight = "",
  maxHeight = "",
  healthStatus = ""
) {
  if (!projectName || layerUpdateInProgress) {
    console.log("No project name specified for tree data fetch.");
    return;
  }
  console.log("Starting data fetch for:", projectName);
  layerUpdateInProgress = true;
  // Clear existing layer
  if (treesLayer) {
    map.removeLayer(treesLayer); // Remove the layer from the map
    treesLayer = null; // Dereference the existing layer
    console.log("Clearing existing treesLayer source.");
  }

  // Fetch the tree data
  var url = `http://localhost:5000/get_tree_data?projectName=${projectName}&minHeight=${minHeight}&maxHeight=${maxHeight}&healthStatus=${healthStatus}`;
  fetch(url)
    .then((response) => response.json())
    .then((treeData) => {
      // Create a new vector source with the fetched data
      var vectorSource = new ol.source.Vector({
        features: new ol.format.GeoJSON().readFeatures(treeData, {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:3857",
        }),
      });
      console.log("Initializing new treesLayer.");

      // Create a new vector layer with the new vector source
      treesLayer = new ol.layer.Vector({
        source: vectorSource,
        style: new ol.style.Style({
          stroke: new ol.style.Stroke({
            color: "rgba(255, 255, 255, 0.01)", // Almost transparent stroke
            width: 1,
          }),
          fill: new ol.style.Fill({
            color: "rgba(255, 255, 255, 0.3)", // Almost transparent fill
          }),
        }),
      });

      // Add the new layer to the map
      console.log("Adding new treesLayer to the map.");
      map.addLayer(treesLayer);

      // Fit the map view to the extent of the new data
      if (treeData.extent) {
        var extent = ol.proj.transformExtent(
          treeData.extent,
          "EPSG:4326",
          "EPSG:3857"
        );
        map.getView().fit(extent, {
          size: map.getSize(),
          maxZoom: 150, // Lower maxZoom to avoid zooming in too much
        });
        updateOverviewMap(treeData.extent);
      }

      // Update the displayed tree count
      document.getElementById("countDisplay").innerText =
        treeData.features.length;
    })
    .catch((error) => {
      console.error("Error fetching tree data:", error);
    })
    .finally(() => {
      console.log("Fetch and display process completed.");
      layerUpdateInProgress = false; // Reset flag after async operations are done
    });
  
}

// Create an overlay to anchor the popup to the map.
var popup = new ol.Overlay({
  element: document.getElementById("popup"),
  positioning: "center-left",
  stopEvent: true,
  offset: [10, 0],
});
map.addOverlay(popup);

// Add a click handler to the map to render the popup.
map.on("singleclick", function (evt) {
  var feature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
    return feature;
  });

  if (feature) {
    var properties = feature.getProperties();
    var infoContent =
      "<p><strong>Tree ID:</strong> " + properties.TreeID + "</p>";
    infoContent += "<p><strong>Health:</strong> " + properties.Health;
    // Add an "i" button to show MGRVI info
    infoContent +=
      ' <button onclick="showMgrviPopup(' +
      properties.MGRVI +
      ')">i</button></p>';
    infoContent += "<p><strong>Height:</strong> " + properties.Height + "</p>";
    infoContent += "<p><strong>Girth:</strong> " + properties.Girth + "</p>";

    document.getElementById("popup-content").innerHTML = infoContent;
    popup.setPosition(evt.coordinate);
  } else {
    popup.setPosition(undefined);
  }
});

/// Function to show MGRVI popup
function showMgrviPopup(mgrvi) {
  var mgrviPopup = document.getElementById("mgrviPopup");
  document.getElementById("mgrviValueSpan").textContent = mgrvi.toFixed(2);
  mgrviPopup.style.display = "block";
  // Get the position of the main popup to position the MGRVI popup next to it
  var mainPopup = document.getElementById("popup");
  var rect = mainPopup.getBoundingClientRect();

  // Position the MGRVI popup next to the main popup horizontally
  mgrviPopup.style.left = rect.right + window.scrollX + 10 + "px"; // 10px to the right of the main popup
  mgrviPopup.style.top = rect.top + window.scrollY + "px"; // Align to the top of the main popup

  // Calculate the position of the red line based on the MGRVI value
  var redDot = document.getElementById("redDot");
  var scaleImage = document.getElementById("mgrviScaleImage");
  var scaleHeight = scaleImage.clientHeight; // The total height of the scale image

  // Calculate the red line's vertical position
  var dotPositionFromBottom = ((1 - mgrvi) / 2) * scaleHeight;

  // Make adjustments if there's padding or margin in the scale image that offsets the position
  var scaleAdjustment = 3.8; // Adjust this as needed to align with the scale's markings

  // Update the bottom style property for the red line
  redDot.style.bottom =
    scaleHeight - dotPositionFromBottom - scaleAdjustment + "px";
  redDot.style.display = "block"; // Show the red line

  var redDotText = document.getElementById("redDotText");
  redDotText.textContent =
    document.getElementById("mgrviValueSpan").textContent; // Reference the heading's value
  redDotText.style.bottom = parseInt(redDot.style.bottom, 10) - 5 + "px"; // Align with the red line's bottom position
  redDotText.style.left = "55px"; // Position to the right of the red line, adjust as needed
  redDotText.style.display = "block";
}

function closeMgrviPopup() {
  var mgrviPopup = document.getElementById("mgrviPopup");
  mgrviPopup.style.display = "none"; // Hide the MGRVI popup
  var dot = document.getElementById("redDot");
  dot.style.display = "none"; // Hide the red dot
}

// Function to close MGRVI popup
function closeMgrviPopup() {
  document.getElementById("mgrviPopup").style.display = "none";
}

// Toggle Tree Layer Visibility
var treeLayerVisible = true; // Initial visibility state

function toggleTreeLayerVisibility() {
  treeLayerVisible = !treeLayerVisible;
  treesLayer.setVisible(treeLayerVisible);
}

// Add button to toggle tree layer visibility
document
  .getElementById("toggleTrees")
  .addEventListener("click", toggleTreeLayerVisibility);

// Mini-map (Overview Map)
var overviewMap = new ol.Map({
  target: "overviewMap",
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM(), // You can replace this with a more India-specific layer if available
    }),
  ],
  view: new ol.View({
    // The initial center and zoom are placeholders; these will be updated dynamically.
    center: ol.proj.fromLonLat([0, 0]),
    zoom: 4,
  }),
});

// Add a red dot to mark the location
// Initialize the source and layer for the red dot location marker
var locationLayerSource = new ol.source.Vector();

var locationLayer = new ol.layer.Vector({
  source: locationLayerSource,
  style: new ol.style.Style({
    image: new ol.style.Circle({
      radius: 5,
      fill: new ol.style.Fill({ color: "red" }),
    }),
  }),
});

overviewMap.addLayer(locationLayer);

// Function to update the overview map with new data extent
function updateOverviewMap(extent) {
  // Calculate the center of the extent
  var centerX = (extent[0] + extent[2]) / 2;
  var centerY = (extent[1] + extent[3]) / 2;
  var center = ol.proj.fromLonLat([centerX, centerY]);

  // Update the overview map's view
  overviewMap.getView().setCenter(center);
  overviewMap.getView().setZoom(6); // Adjust zoom level for a good overview

  // Update the red dot location
  var locationFeature = new ol.Feature({
    geometry: new ol.geom.Point(center),
  });
  locationLayerSource.clear(); // Clear the previous location
  locationLayerSource.addFeature(locationFeature); // Add the new location

  // Update the displayed coordinates
  var coordDiv = document.getElementById("overviewMapCoordinates");
  if (!coordDiv) {
    coordDiv = document.createElement("div");
    coordDiv.id = "overviewMapCoordinates";
    document.getElementById("overviewMap").appendChild(coordDiv);
    console.log("Extent received:", extent);
    console.log("Center coordinates:", centerX, centerY);
  }
  coordDiv.textContent =
    "Coordinates: " + centerX.toFixed(6) + ", " + centerY.toFixed(6);
}

function applyFilters() {
  var minHeight = document.getElementById("minHeight").value;
  var maxHeight = document.getElementById("maxHeight").value;
  var healthStatus = document.getElementById("healthStatus").value;
  var projectName = document.getElementById("projectSelection").value;
  console.log("Applying filters.");
  fetchAndDisplayTreeData(projectName, minHeight, maxHeight, healthStatus);
}

document
  .getElementById("addProjectButton")
  .addEventListener("click", function () {
    window.location.href = "http://127.0.0.1:5500/index.html"; // This will refresh the page
  });

document
  .getElementById("defaultViewButton")
  .addEventListener("click", function () {
    window.location.reload(); // This will refresh the page
  });
function fetchProjectNames() {
  fetch("http://localhost:5000/projects") // Adjust the URL to your endpoint
    .then((response) => response.json())
    .then((data) => {
      const projectSelection = document.getElementById("projectSelection");
      data.projects.forEach((projectName) => {
        const option = new Option(projectName, projectName); // Use projectName directly
        projectSelection.add(option);
      });
      updateMapLayers();
    })
    .catch((error) => console.error("Error fetching project names:", error));
}

document.getElementById("logoutButton").addEventListener("click", function () {
  fetch("http://localhost:5000/logout")
    .then((response) => {
      if (response.ok) {
        console.log("You are now logged out.");
        // Redirect to login.html
        window.location.href = "http://127.0.0.1:5500/login.html";
      }
    })
    .catch((error) => console.error("Error logging out:", error));
});