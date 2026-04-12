import asyncio
from backend.app.graph.seed_pipeline import Neo4jSeedPipeline


def main():
    pipeline = Neo4jSeedPipeline()
    success = asyncio.run(pipeline.seed_all_data(include_edge_cases=False))
    if success:
        print("Neo4j seed pipeline completed successfully.")
    else:
        print("Neo4j seed pipeline failed.")


if __name__ == "__main__":
    main()
