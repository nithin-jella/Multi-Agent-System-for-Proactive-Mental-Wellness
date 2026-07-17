
import re
import logging

from src.model.schema import Entity, Relation

logger = logging.getLogger(__name__)

def remove_duplicates_by_keys(obj_list: list, keys: list[str]) -> list:
    """
    Remove duplicates from a list of dicts or objects based on specified keys.

    :param obj_list: List of dictionaries or Pydantic objects to deduplicate
    :param keys: Keys or attributes to determine uniqueness
    :return: List of unique items
    """
    try:
        seen = set()
        unique_list = []

        for obj in obj_list:
            # Support both dicts and objects (e.g., Pydantic models)
            identifier = tuple(
                getattr(obj, k, None) if not isinstance(obj, dict) else obj.get(k)
                for k in keys
            )
            if identifier not in seen:
                seen.add(identifier)
                unique_list.append(obj)

        return unique_list
    except Exception as e:
        logger.error(f"Fail to remove duplicate: {e}")
        return obj_list

def resolve_entities_with_merged_descriptions(entities: list[Entity]) -> tuple[list[Entity], dict]:
    """
    Deduplicates entities based on a normalized name, merges their unique descriptions,
    and creates a mapping from old names to the canonical entity name.
    """
    canonical_entities = {}  # {normalized_name: canonical_entity_object}
    name_map = {}            # {original_name: canonical_name}

    for entity in entities:
        # Kunci utama untuk de-duplikasi adalah nama yang dinormalisasi
        normalized_name = entity.name.lower().strip()
        
        # Inisialisasi pemetaan nama jika belum ada
        if entity.name not in name_map:
            if normalized_name in canonical_entities:
                # Jika nama asli ini merujuk ke entitas kanonis yang sudah ada
                name_map[entity.name] = canonical_entities[normalized_name].name
            else:
                # Ini akan menjadi entitas kanonis baru
                name_map[entity.name] = entity.name

        if normalized_name not in canonical_entities:
            # Ini pertama kalinya kita melihat entitas ini, jadikan ia kanonis
            canonical_entities[normalized_name] = entity
        else:
            existing_entity = canonical_entities[normalized_name]
            
            sentence_splitter = re.compile(r'(?<=[.?!])\s+')
            
            unique_sentences = set()

            # 1. Tambahkan kalimat dari deskripsi yang sudah ada
            # Memastikan tidak ada string kosong setelah split
            existing_sentences = filter(None, sentence_splitter.split(existing_entity.description))
            for sentence in existing_sentences:
                unique_sentences.add(sentence.strip())

            # 2. Tambahkan kalimat dari deskripsi entitas baru yang ditemukan
            new_sentences = filter(None, sentence_splitter.split(entity.description))
            for sentence in new_sentences:
                unique_sentences.add(sentence.strip())

            # 3. Gabungkan kembali kalimat-kalimat unik menjadi satu deskripsi baru
            # 'sorted' digunakan agar urutan output konsisten setiap kali dijalankan
            merged_description = " ".join(sorted(list(unique_sentences)))

            # Perbarui deskripsi pada entitas kanonis
            existing_entity.description = merged_description
            
            # Perbarui juga peta nama jika nama kanonisnya berubah (misal: karena perbedaan huruf besar/kecil)
            name_map[entity.name] = existing_entity.name


    unique_entities = list(canonical_entities.values())
    return unique_entities, name_map

def remap_relations(relations: list[Relation], entity_name_map: dict) -> list[Relation]:
    remapped_relations: list[Relation] = []
    for relation in relations:
        canonical_source = entity_name_map.get(relation.source_entity)
        canonical_target = entity_name_map.get(relation.target_entity)

        if canonical_source and canonical_target:
            relation.source_entity = canonical_source
            relation.target_entity = canonical_target
            remapped_relations.append(relation)
    return remapped_relations