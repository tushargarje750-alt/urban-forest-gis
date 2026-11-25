import os
import sys
import secrets
import psycopg2
import subprocess
import json
from psycopg2 import sql
from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    session,
    redirect,
)
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from flask_cors import CORS

# Local settings (passwords, keys, paths) come from environment variables,
# optionally loaded from a .env file next to this one. See .env.example.
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
# ---------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------

# PROJ data for rasterio / GDAL: if your install needs it, set PROJ_LIB in .env
# (it is passed on to the processing scripts).

app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or secrets.token_hex(32)

CORS(app, resources={r"/*": {"origins": "*"}})

# Base paths and upload directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "app", "tif_files")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# PostgreSQL database details
db_params = {
    "dbname": os.environ.get("DB_NAME", "TREE"),
    "user": os.environ.get("DB_USER", "postgres"),
    "password": os.environ.get("DB_PASSWORD", ""),
    "host": os.environ.get("DB_HOST", "localhost"),
    "port": os.environ.get("DB_PORT", "5432"),
}

ALLOWED_EXTENSIONS = {"tif", "tiff"}
MAX_FILE_SIZE = 350 * 1024 * 1024  # 350 MB

processing_status = "idle"


# ---------------------------------------------------
# DATABASE CONNECTION
# ---------------------------------------------------

def get_db_connection():
    return psycopg2.connect(**db_params)


# ---------------------------------------------------
# HELPER – FILE CHECK
# ---------------------------------------------------

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.split(".")[-1].lower() in ALLOWED_EXTENSIONS


# ---------------------------------------------------
# FRONTEND ROUTES
# ---------------------------------------------------

@app.route("/")
def index_page():
    return render_template("index.html")


@app.route("/login_page")
def login_page():
    return render_template("login.html")


@app.route("/register_page")
def register_page():
    return render_template("register.html")


# original route name you had
@app.route("/results_page")
def results_page():
    return render_template("results.html")


# NEW route so /results works too
@app.route("/results")
def results():
    return render_template("results.html")


# ---------------------------------------------------
# AUTH ROUTES
# ---------------------------------------------------

@app.route("/register", methods=["POST"])
def register_user():
    username = request.form["username"]
    password = request.form["password"]
    confirm_password = request.form["confirm_password"]

    if password != confirm_password:
        return jsonify({"status": "fail", "message": "Passwords do not match"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT username FROM users WHERE username=%s", (username,))
    if cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"status": "fail", "message": "Username already exists"}), 409

    hashed_pw = generate_password_hash(password)

    cur.execute(
        "INSERT INTO users (username, password) VALUES (%s, %s)",
        (username, hashed_pw),
    )
    conn.commit()

    cur.close()
    conn.close()

    return jsonify({"status": "success"}), 201


@app.route("/login_page", methods=["POST"])
def login_user():
    username = request.form["username"]
    password = request.form["password"]

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT username, password FROM users WHERE username=%s", (username,))
    user = cur.fetchone()

    cur.close()
    conn.close()

    if user and check_password_hash(user[1], password):
        session["user"] = username
        return jsonify({"status": "success"}), 200

    return jsonify({"status": "fail"}), 401


@app.route("/logout")
def logout_user():
    session.clear()
    return redirect("/login_page")


# ---------------------------------------------------
# PROJECT MANAGEMENT
# ---------------------------------------------------

@app.route("/add_project", methods=["POST"])
def add_project():
    project_name = request.form.get("projectName")

    if not project_name:
        return jsonify({"error": "Project name missing"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO projects(name) 
        VALUES (%s)
        ON CONFLICT(name) DO NOTHING;
        """,
        (project_name,),
    )

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"status": "success"}), 200


@app.route("/projects", methods=["GET"])
def get_projects():
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT name FROM projects;")
    result = [row[0] for row in cur.fetchall()]

    cur.close()
    conn.close()

    return jsonify({"projects": result})


# ---------------------------------------------------
# FILE UPLOAD + PROCESSING
# ---------------------------------------------------

@app.route("/upload", methods=["POST"])
def upload_files():
    global processing_status
    processing_status = "processing"

    project_name = request.form.get("projectName", "default_project").strip()
    if not project_name:
        processing_status = "idle"
        return jsonify({"error": "Project name missing"}), 400

    uploads = {
        "ortho": request.files.get("ortho"),
        "dem": request.files.get("dem"),
        "dtm": request.files.get("dtm"),
    }

    # Save files
    for ftype, file in uploads.items():
        if not file or not allowed_file(file.filename):
            continue

        filename = secure_filename(f"{project_name}_{ftype}.tif")
        file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(file_path)

    try:
        # Run processing pipeline
        subprocess.run([sys.executable, "app/sharanga.py", project_name], check=True)
        subprocess.run([sys.executable, "app/geoserver.py", project_name], check=True)

        processing_status = "done"
    except Exception as e:
        # you can print the error if you want to debug further
        print("[ERROR] processing pipeline failed:", e)
        processing_status = "error"

    return jsonify({"status": "ok"}), 200


@app.route("/status")
def get_status():
    return jsonify({"status": processing_status})


# ---------------------------------------------------
# FETCH TREE DATA FOR MAP
# ---------------------------------------------------

# def fetch_tree_data_from_db(project_name, min_h, max_h, health):
#     conn = get_db_connection()
#     cur = conn.cursor()

#     table = f"{project_name}_trees"

#     query = sql.SQL(
#         """
#         SELECT tree_id, girth, height, health, mgrvi, 
#                ST_AsGeoJSON(geom)::json 
#         FROM {} WHERE 1=1
#         """
#     ).format(sql.Identifier(table))

#     params = []

#     if min_h is not None:
#         query += sql.SQL(" AND height >= %s")
#         params.append(min_h)

#     if max_h is not None:
#         query += sql.SQL(" AND height <= %s")
#         params.append(max_h)

#     if health:
#         query += sql.SQL(" AND LOWER(health)=LOWER(%s)")
#         params.append(health)

#     cur.execute(query, params)
#     rows = cur.fetchall()

#     geojson = {"type": "FeatureCollection", "features": []}

#     for r in rows:
#         geojson["features"].append(
#             {
#                 "type": "Feature",
#                 "properties": {
#                     "TreeID": r[0],
#                     "Girth": r[1],
#                     "Height": r[2],
#                     "Health": r[3],
#                     "MGRVI": r[4],
#                 },
#                 "geometry": r[5],
#             }
#         )

#     cur.close()
#     conn.close()

#     return geojson
def fetch_tree_data_from_db(project_name, min_h, max_h, health):
    conn = get_db_connection()
    cur = conn.cursor()

    table = f"{project_name}_trees"

    # Get geometry as TEXT, we'll json.loads it in Python
    query = sql.SQL(
        """
        SELECT tree_id, girth, height, health, mgrvi,
               ST_AsGeoJSON(geom) AS geom_json
        FROM {} WHERE 1=1
        """
    ).format(sql.Identifier(table))

    params = []

    if min_h is not None:
        query += sql.SQL(" AND height >= %s")
        params.append(min_h)

    if max_h is not None:
        query += sql.SQL(" AND height <= %s")
        params.append(max_h)

    if health:
        query += sql.SQL(" AND LOWER(health) = LOWER(%s)")
        params.append(health)

    cur.execute(query, params)
    rows = cur.fetchall()

    geojson = {"type": "FeatureCollection", "features": []}

    for r in rows:
        geom_obj = json.loads(r[5])  # <- convert string to real dict

        feature = {
            "type": "Feature",
            "properties": {
                "TreeID": r[0],
                "Girth": float(r[1]) if r[1] is not None else None,
                "Height": float(r[2]) if r[2] is not None else None,
                "Health": r[3],
                "MGRVI": float(r[4]) if r[4] is not None else None,
            },
            "geometry": geom_obj,
        }
        geojson["features"].append(feature)

    cur.close()
    conn.close()

    return geojson


def get_extent(project_name):
    conn = get_db_connection()
    cur = conn.cursor()

    table = f"{project_name}_trees"

    cur.execute(
        sql.SQL("SELECT ST_Extent(geom) FROM {};").format(sql.Identifier(table))
    )

    box = cur.fetchone()[0]

    cur.close()
    conn.close()

    if not box:
        return None

    box = box.replace("BOX(", "").replace(")", "")
    p1, p2 = box.split(",")

    x1, y1 = map(float, p1.split(" "))
    x2, y2 = map(float, p2.split(" "))

    return [x1, y1, x2, y2]


@app.route("/get_tree_data")
def get_tree_data_api():
    project_name = request.args.get("projectName")
    min_h = request.args.get("minHeight", type=float)
    max_h = request.args.get("maxHeight", type=float)
    health = request.args.get("healthStatus")

    data = fetch_tree_data_from_db(project_name, min_h, max_h, health)
    data["extent"] = get_extent(project_name)

    return jsonify(data)


# ---------------------------------------------------
# RUN SERVER
# ---------------------------------------------------

if __name__ == "__main__":
    app.run(debug=True)
