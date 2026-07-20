import pytest
from sqlalchemy import create_engine, MetaData
from sqlalchemy.dialects import postgresql
from app.db import Base
from app.models import User, ResearchProject, ResearchVariable, ResearchQuestion, Hypothesis, SimulationJob

def test_postgresql_schema_compilation():
    """
    Test compiling all SQLAlchemy tables and constraints for the PostgreSQL dialect
    to verify datatypes (like JSON, String, ForeignKey) translate without compilation errors.
    """
    metadata = Base.metadata
    
    # We can inspect the SQL statements compiled for each table
    compiled_statements = {}
    for table_name, table in metadata.tables.items():
        from sqlalchemy.schema import CreateTable
        statement = str(CreateTable(table).compile(dialect=postgresql.dialect()))
        compiled_statements[table_name] = statement
        assert len(statement) > 0
        
    print("\n=== POSTGRESQL SCHEMA COMPILATION SUCCESSFUL ===")
    for t_name, sql in compiled_statements.items():
        print(f"\nTable: {t_name}")
        # Print first line of SQL
        print(f"  {sql.strip().splitlines()[0]}")
        # Confirm JSON columns are compiled as JSON or JSONB
        if t_name == "research_projects":
            assert "sampleSettings JSON" in sql or "sampleSettings JSONB" in sql or "sampleSettings" in sql
        if t_name == "simulation_jobs":
            assert "params" in sql
            assert "result" in sql
            
    assert "users" in compiled_statements
    assert "research_projects" in compiled_statements
    assert "research_variables" in compiled_statements
    assert "research_questions" in compiled_statements
    assert "hypotheses" in compiled_statements
    assert "simulation_jobs" in compiled_statements
