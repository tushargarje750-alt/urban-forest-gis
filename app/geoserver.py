import os
import sys
import requests
from requests.auth import HTTPBasicAuth

# --------------------------------------------------------------------
# PATH SETUP  (IMPORTANT)
# --------------------------------------------------------------------
# This file lives in:  ...\TREE\app\geoserver.py
# TIFFs live in:       ...\TREE\app\tif_files\*.tif
# We build absolute paths so it works no matter where Python is started.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_TIFF_DIRECTORY = os.path.join(BASE_DIR, "tif_files")

# Project name comes from command line argument
# Example:  python geoserver.py tushar
project_name = sys.argv[1] if len(sys.argv) > 1 else "default_project"

# --------------------------------------------------------------------
# GeoServer configuration
# --------------------------------------------------------------------
# Settings come from the environment, optionally a .env file (see .env.example)
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

GEOSERVER_REST_URL = os.environ.get("GEOSERVER_URL", "http://localhost:8080/geoserver").rstrip("/") + "/rest"
GEOSERVER_WORKSPACE = "Sharanga"
GEOSERVER_USER = os.environ.get("GEOSERVER_USER", "admin")
GEOSERVER_PASS = os.environ.get("GEOSERVER_PASSWORD", "geoserver")

AUTH = HTTPBasicAuth(GEOSERVER_USER, GEOSERVER_PASS)


# --------------------------------------------------------------------
# Helper functions
# --------------------------------------------------------------------
def get_dynamic_store_name(project: str, data_type: str) -> str:
    """
    Build a unique coverage store name, e.g.:
      project='tushar', data_type='ortho'  ->  'tushar_ortho_store'
    """
    return f"{project}_{data_type}_store"


def delete_coverage_store(workspace: str, store_name: str):
    """
    Delete a coverage store (and any associated coverages/layers).
    """
    url = (
        f"{GEOSERVER_REST_URL}/workspaces/{workspace}/"
        f"coveragestores/{store_name}?recurse=true"
    )
    resp = requests.delete(url, auth=AUTH)
    print(f"Delete coverage store '{store_name}': {resp.status_code}")
    return resp


def delete_layer(layer_name: str):
    """
    Delete a layer by name.

    NOTE: the correct REST endpoint is:
      DELETE /rest/layers/{layer_name}?recurse=true
    not /workspaces/{ws}/layers/{layer_name}
    """
    url = f"{GEOSERVER_REST_URL}/layers/{layer_name}?recurse=true"
    resp = requests.delete(url, auth=AUTH)
    print(f"Delete layer '{layer_name}': {resp.status_code}")
    return resp


def upload_geotiff_as_coverage(workspace: str,
                               store_name: str,
                               coverage_name: str,
                               file_path: str):
    """
    Upload a single GeoTIFF to GeoServer as a coverage store + coverage + layer
    in one step using:

      PUT /workspaces/{ws}/coveragestores/{store}/file.geotiff

    This is the recommended way to publish a GeoTIFF via REST.
    """
    # Ensure file exists
    if not os.path.exists(file_path):
        print(f"[ERROR] GeoTIFF not found at: {file_path}")
        return None

    # URL with configure=all to create store + coverage + layer in one go.
    url = (
        f"{GEOSERVER_REST_URL}/workspaces/{workspace}/"
        f"coveragestores/{store_name}/file.geotiff"
        f"?configure=all&coverageName={coverage_name}"
    )

    print(f"[INFO] Uploading GeoTIFF to GeoServer:\n"
          f"  workspace: {workspace}\n"
          f"  store:     {store_name}\n"
          f"  coverage:  {coverage_name}\n"
          f"  path:      {file_path}\n")

    with open(file_path, "rb") as tif_file:
        headers = {"Content-Type": "image/tiff"}
        resp = requests.put(url, headers=headers, data=tif_file.read(), auth=AUTH)

    print(f"Create / upload coverage store '{store_name}': {resp.status_code}")
    if not resp.ok:
        print(f"[ERROR] Response text: {resp.text}")
    return resp


# --------------------------------------------------------------------
# Main processing for one layer type (ortho / colored / mgrvi)
# --------------------------------------------------------------------
def process_layer(project: str, data_type: str):
    """
    data_type: 'ortho', 'colored', 'mgrvi'
    Expects file:  <project>_<data_type>.tif  in app/tif_files

    Example:
      project='tushar', data_type='ortho' -> 'tushar_ortho.tif'
    """
    # 1) Local file path
    file_name = f"{project}_{data_type}.tif"
    file_path = os.path.join(BASE_TIFF_DIRECTORY, file_name)

    if not os.path.exists(file_path):
        print(f"[ERROR] TIFF for '{data_type}' not found at: {file_path}")
        return

    # 2) GeoServer layer / coverage name (no extension)
    layer_name, _ = os.path.splitext(file_name)

    # 3) Unique coverage store name
    store_name = get_dynamic_store_name(project, data_type)

    print("\n------------------------------------------------------------")
    print(f"[INFO] Processing layer type: {data_type}")
    print(f"[INFO] Project:       {project}")
    print(f"[INFO] TIFF path:     {file_path}")
    print(f"[INFO] Layer name:    {layer_name}")
    print(f"[INFO] Store name:    {store_name}")
    print("------------------------------------------------------------")

    # 4) Clean up any previous layer/store with same names
    delete_layer(layer_name)                           # may be 404 if not exist; that's OK
    delete_coverage_store(GEOSERVER_WORKSPACE, store_name)  # also may be 404/200; OK

    # 5) Upload GeoTIFF as a new coverage store + coverage + WMS layer
    resp = upload_geotiff_as_coverage(
        GEOSERVER_WORKSPACE,
        store_name,
        layer_name,
        file_path,
    )

    if resp is not None and resp.status_code in (201, 202):
        print(f"[OK] Layer '{layer_name}' published successfully.")
    else:
        print(f"[ERROR] Failed to publish layer '{layer_name}'. "
              f"Status: {resp.status_code if resp is not None else 'N/A'}")


# --------------------------------------------------------------------
# Script entry
# --------------------------------------------------------------------
if __name__ == "__main__":
    print("============================================================")
    print(f"[INFO] GeoServer publish script started for project: {project_name}")
    print(f"[INFO] TIFF directory: {BASE_TIFF_DIRECTORY}")
    print("============================================================")

    # Publish the 3 rasters for this project into GeoServer
    process_layer(project_name, "ortho")
    process_layer(project_name, "colored")
    process_layer(project_name, "mgrvi")

    print("============================================================")
    print("[INFO] GeoServer publish script finished.")
    print("============================================================")
