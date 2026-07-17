import aiofiles


from src.model.schema import Entity

async def load_doc_and_entities(chunk_id: str):
            file_path = f"./data/{chunk_id}"
            async with aiofiles.open(file_path, mode="r") as f:
                doc = await f.read()
            entities: list[Entity] = await graph_service.get_entities_chunk_id(chunk_id=chunk_id)
            return chunk_id, doc, entities