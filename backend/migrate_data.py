import sqlite3
import psycopg2
from psycopg2.extras import DictCursor

def migrate():
    # Connect to SQLite
    sqlite_conn = sqlite3.connect('chat_app.db')
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()

    # Connect to PostgreSQL
    pg_conn = psycopg2.connect("postgresql://chatuser:chatpassword@localhost/chat_app_prod")
    pg_cur = pg_conn.cursor()

    tables = ['users', 'conversations', 'conversation_participants', 'messages']

    try:
        for table in tables:
            print(f"Migrating {table}...")
            sqlite_cur.execute(f"SELECT * FROM {table}")
            rows = sqlite_cur.fetchall()
            
            if not rows:
                print(f"No data in {table}")
                continue

            # Get column names
            cols = rows[0].keys()
            col_names = ', '.join(cols)
            placeholders = ', '.join(['%s'] * len(cols))
            
            insert_query = f"INSERT INTO {table} ({col_names}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
            
            data = [tuple(row[col] for col in cols) for row in rows]
            
            # Use executemany for efficiency
            pg_cur.executemany(insert_query, data)
            print(f"Inserted {len(rows)} rows into {table}")

        pg_conn.commit()
        print("Migration complete!")

    except Exception as e:
        pg_conn.rollback()
        print(f"Migration failed: {e}")
    finally:
        sqlite_conn.close()
        pg_conn.close()

if __name__ == "__main__":
    migrate()
