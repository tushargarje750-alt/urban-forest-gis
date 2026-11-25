import os
import psycopg2
import requests
from psycopg2 import sql
from requests.auth import HTTPBasicAuth

# Settings come from the environment, optionally a .env file (see .env.example)
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

# Database connection parameters
dbname = os.environ.get("DB_NAME", "TREE")
user = os.environ.get("DB_USER", "postgres")
password = os.environ.get("DB_PASSWORD", "")
host = os.environ.get("DB_HOST", "localhost")
port = os.environ.get("DB_PORT", "5432")

TREES_DB_NAME = dbname
TREES_USER = user
TREES_PASSWORD = password
TREES_HOST = host
TREES_PORT = port

# GeoServer details
GEOSERVER_REST_URL = os.environ.get("GEOSERVER_URL", "http://localhost:8080/geoserver").rstrip("/") + "/rest"
GEOSERVER_WORKSPACE = "Sharanga"
GEOSERVER_USER = os.environ.get("GEOSERVER_USER", "admin")
GEOSERVER_PASS = os.environ.get("GEOSERVER_PASSWORD", "geoserver")

SUFFIXES = ["ortho", "mgrvi", "colored"]


def delete_coverage_store(workspace, store_name):
    delete_url = f"{GEOSERVER_REST_URL}/workspaces/{workspace}/coveragestores/{store_name}?recurse=true"
    response = requests.delete(
        delete_url, auth=HTTPBasicAuth(GEOSERVER_USER, GEOSERVER_PASS)
    )
    print(f"Delete response for {store_name}: {response.status_code}")


def delete_layer(workspace, layer_name):
    delete_url = f"{GEOSERVER_REST_URL}/workspaces/{workspace}/layers/{layer_name}"
    response = requests.delete(
        delete_url, auth=HTTPBasicAuth(GEOSERVER_USER, GEOSERVER_PASS)
    )
    print(f"Delete response for {layer_name}: {response.status_code}")


def logout_and_cleanup():
    # Connect to the database
    conn = psycopg2.connect(
        dbname=dbname, user=user, password=password, host=host, port=port
    )
    cur = conn.cursor()

    trees_conn = psycopg2.connect(
        dbname=TREES_DB_NAME,
        user=TREES_USER,
        password=TREES_PASSWORD,
        host=TREES_HOST,
        port=TREES_PORT,
    )
    trees_cur = trees_conn.cursor()

    try:
        # Retrieve project names from the projects table
        cur.execute("SELECT name FROM projects;")
        project_names = [row[0] for row in cur.fetchall()]

        # Delete all rows from the projects table
        cur.execute("DELETE FROM projects;")
        print("Deleted all rows from the projects table.")

        for project_name in project_names:
            # Delete the corresponding project_name_trees table
            try:
                trees_cur.execute(
                    sql.SQL("DROP TABLE IF EXISTS {} CASCADE").format(
                        sql.Identifier(f"{project_name}_trees")
                    )
                )
                # Delete GeoServer layers for each suffix
                for suffix in SUFFIXES:
                    layer_name = f"{project_name}_{suffix}"
                    delete_layer(GEOSERVER_WORKSPACE, layer_name)
                    delete_coverage_store(GEOSERVER_WORKSPACE, layer_name)

                trees_conn.commit()  # Commit after each project's layers are processed
                print(f"Processed and deleted table/layers for project: {project_name}")
            except Exception as e:
                print(f"An error occurred processing {project_name}: {e}")
                trees_conn.rollback()  # Rollback this project's transactions if an error occurs

        # Commit changes and close the database connection
        conn.commit()
    except Exception as e:
        print(f"An error occurred: {e}")
        conn.rollback()
        trees_conn.rollback()
    finally:
        cur.close()
        conn.close()
        trees_cur.close()
        trees_conn.close()


# Run the logout and cleanup process
logout_and_cleanup()