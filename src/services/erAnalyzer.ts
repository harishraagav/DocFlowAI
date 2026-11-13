
import {
    ERAnalysis,
    EREntity,
    ERRelationship,
    WorkspaceSnapshot
} from '../utilities/types';

import { callOllama } from './ollamaClient';

export async function analyseER(
    project: WorkspaceSnapshot
): Promise<ERAnalysis> {

    const prompt = `
You are a senior database architect and software reverse engineer.

Analyze the ACTUAL project source code and file tree.

Your task is to identify the application's real data storage architecture.

IMPORTANT DISTINCTION:

Identify storage explicitly created or used by the APPLICATION.

Do NOT report internal storage implementations of third-party libraries
as application-level databases.

For example:
- LangChain Chroma may internally use SQLite.
- That does NOT mean the application defines an SQLite database.
- Do not invent SQLite tables or entities unless the application itself
  explicitly defines or accesses them.

SUPPORTED STORAGE TYPES:

1. relational-table
   Explicitly defined SQL tables and ORM-backed relational entities.

2. vector-collection
   Actual vector database collections containing embeddings,
   document IDs, content and metadata.

3. document-collection
   Actual document-oriented database collections.

4. source-dataset
   CSV, JSON, Excel, Parquet and other input datasets.

5. file-store
   Explicit persistent file or directory storage.

6. unknown
   Storage whose type cannot be established.

PROJECT FILE TREE:
${project.tree}

PROJECT SOURCE CODE:
${project.source}

Return ONLY valid JSON using this structure:

{
  "overview": "Evidence-based storage architecture description",
  "databaseTechnology": "Chroma or Unknown",
  "entities": [
    {
      "id": "reviews_csv",
      "name": "Coffee Shop Reviews CSV",
      "tableName": "coffee_shop_reviews.csv",
      "description": "Source dataset containing coffee shop reviews",
      "storageType": "source-dataset",
      "columns": [
        {
          "name": "Title",
          "dataType": "CSV field",
          "isPrimaryKey": false,
          "isForeignKey": false,
          "isNullable": false,
          "isUnique": false,
          "role": "field"
        },
        {
          "name": "Date",
          "dataType": "CSV field",
          "isPrimaryKey": false,
          "isForeignKey": false,
          "isNullable": false,
          "isUnique": false,
          "role": "field"
        },
        {
          "name": "Rating",
          "dataType": "CSV field",
          "isPrimaryKey": false,
          "isForeignKey": false,
          "isNullable": false,
          "isUnique": false,
          "role": "field"
        },
        {
          "name": "Review",
          "dataType": "CSV field",
          "isPrimaryKey": false,
          "isForeignKey": false,
          "isNullable": false,
          "isUnique": false,
          "role": "field"
        }
      ]
    },
    {
      "id": "review_collection",
      "name": "Coffee Shop Reviews",
      "tableName": "coffee_shop_reviews",
      "description": "Chroma collection storing review documents and embeddings",
      "storageType": "vector-collection",
      "columns": [
        {
          "name": "document_id",
          "dataType": "String",
          "isPrimaryKey": false,
          "isForeignKey": false,
          "isNullable": false,
          "isUnique": true,
          "role": "document-id"
        },
        {
          "name": "page_content",
          "dataType": "String",
          "isPrimaryKey": false,
          "isForeignKey": false,
          "isNullable": false,
          "isUnique": false,
          "role": "content"
        },
        {
          "name": "embedding",
          "dataType": "Vector",
          "isPrimaryKey": false,
          "isForeignKey": false,
          "isNullable": false,
          "isUnique": false,
          "role": "embedding"
        },
        {
          "name": "metadata",
          "dataType": "Object",
          "isPrimaryKey": false,
          "isForeignKey": false,
          "isNullable": true,
          "isUnique": false,
          "role": "metadata"
        }
      ]
    }
  ],
  "relationships": [
    {
      "fromEntity": "reviews_csv",
      "toEntity": "review_collection",
      "fromColumn": "*",
      "toColumn": "document_id",
      "type": "one-to-many-document",
      "kind": "data-ingestion",
      "label": "Review records ingested into Chroma",
      "evidence": "CSV rows are converted into LangChain Documents and added to the Chroma collection using row-index IDs"
    }
  ]
}

STRICT RULES:

ENTITY DETECTION:
1. Every entity MUST have direct evidence in the project.
2. Do not invent databases, tables, collections or storage paths.
3. Do not classify a third-party library's internal implementation
   as application-level storage.
4. Do not create an SQLite entity just because Chroma or another
   dependency may internally use SQLite.
5. Do not create entities based only on dependency names in package files.
6. Identify actual storage names from source code.
7. Use unique lowercase entity IDs containing letters, numbers and underscores.

RELATIONAL STORAGE:
8. Require explicit application-level SQL or ORM evidence.
9. Identify actual tables and persisted fields.
10. Never infer primary keys, foreign keys or constraints from names.
11. Do not create relational tables for vector collections.

VECTOR STORAGE:
12. Identify actual vector database technology and collection names.
13. Identify document IDs, page content, embeddings and metadata
    when supported by implementation.
14. Identify the embedding model when available.
15. Do not invent separate vector tables.
16. Represent source-to-vector ingestion using data-ingestion.

SOURCE DATASETS:
17. Identify actual structured input files used by the application.
18. Extract ALL available CSV header fields, not just fields used in
    the processing code.
19. Do not invent dataset fields.
20. Distinguish source datasets from persistent databases.

FILE STORAGE:
21. Identify actual persistent paths and file storage.
22. Do not classify ordinary source files as persistent storage.

RELATIONSHIPS:
23. Use only:
    foreign-key, application-mapping, embedding-association,
    data-ingestion, collection-membership.
24. Use only:
    one-to-one, one-to-many, many-to-many,
    one-to-many-document, unknown.
25. Relationships require actual source-code evidence.
26. Do not invent relationships just to connect entities.
27. Use "*" as fromColumn only for whole-record ingestion.
28. Include concise evidence for every relationship.
29. Do not create duplicate relationships.

Return valid JSON only, without Markdown fences.
`;

    const result = await callOllama(prompt, true);

    let parsed: ERAnalysis;

    try {
        const cleaned = result
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/, '')
            .trim();

        parsed = JSON.parse(cleaned) as ERAnalysis;

    } catch {
        throw new Error(
            'Ollama returned invalid Database Storage Model analysis JSON.'
        );
    }

    return validateERAnalysis(parsed, project);
}


// --------------------------------------------------
// SOURCE EVIDENCE HELPERS
// --------------------------------------------------

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsExactIdentifier(
    text: string,
    value: string
): boolean {

    if (!value.trim()) return false;

    const pattern = new RegExp(
        `(^|[^a-zA-Z0-9_])${escapeRegex(value)}($|[^a-zA-Z0-9_])`,
        'i'
    );

    return pattern.test(text);
}

function getBaseName(value: string): string {
    return value.split(/[\\/]/).pop()?.trim() || value;
}

function hasVectorDatabaseEvidence(source: string): boolean {
    return /\b(Chroma|ChromaDB|Pinecone|Qdrant|Weaviate|Milvus|FAISS|PGVector)\b/i.test(source);
}

function hasDocumentDatabaseEvidence(source: string): boolean {
    return /\b(MongoClient|MongoDB|Firestore|firebase_admin|DynamoDB|DocumentDB)\b/i.test(source);
}

function hasRelationalDatabaseEvidence(source: string): boolean {
    return (
        /\bsqlite3\.connect\s*\(/i.test(source) ||
        /sqlite:\/\/\//i.test(source) ||
        /\bCREATE\s+TABLE\b/i.test(source) ||
        /\b(postgres(?:ql)?|mysql|mariadb)\s*:/i.test(source) ||
        /\bSQLAlchemy\b/i.test(source) ||
        /\bSessionLocal\b/i.test(source)
    );
}

function hasPersistentFileEvidence(source: string): boolean {
    return (
        /\bpersist_directory\s*=/i.test(source) ||
        /\bwriteFile(?:Sync)?\s*\(/i.test(source) ||
        /\bopen\s*\([^)]*,\s*['"][wa]/i.test(source) ||
        /\bto_csv\s*\(/i.test(source) ||
        /\bto_parquet\s*\(/i.test(source)
    );
}


// --------------------------------------------------
// CSV HEADER EXTRACTION
// --------------------------------------------------

function extractCSVHeaders(
    fileName: string,
    source: string
): string[] {

    const fileIndex = source.toLowerCase().indexOf(
        fileName.toLowerCase()
    );

    if (fileIndex === -1) {
        return [];
    }

    const nearbyText = source.slice(
        fileIndex,
        fileIndex + 12000
    );

    const lines = nearbyText.split(/\r?\n/);

    for (const line of lines.slice(1, 80)) {

        const candidate = line.trim();

        if (
            !candidate.includes(',') ||
            candidate.startsWith('#') ||
            candidate.startsWith('//')
        ) {
            continue;
        }

        const fields = candidate
            .split(',')
            .map(field => field.trim().replace(/^["']|["']$/g, ''));

        if (
            fields.length < 2 ||
            fields.some(field => !/^[a-zA-Z_][a-zA-Z0-9 _-]*$/.test(field))
        ) {
            continue;
        }

        return [...new Set(fields)];
    }

    return [];
}


// --------------------------------------------------
// ENTITY EVIDENCE VALIDATION
// --------------------------------------------------

function hasEntityEvidence(
    entity: EREntity,
    project: WorkspaceSnapshot
): boolean {

    const tree = project.tree || '';
    const source = project.source || '';

    const combined = `${tree}\n${source}`;

    const tableName = entity.tableName.trim();
    const baseName = getBaseName(tableName);

    switch (entity.storageType) {

        case 'source-dataset': {

            const extension = /\.(csv|json|xlsx?|parquet|tsv)$/i.test(baseName);

            return (
                extension &&
                containsExactIdentifier(combined, baseName)
            );
        }

        case 'vector-collection': {

            return (
                hasVectorDatabaseEvidence(source) &&
                containsExactIdentifier(source, tableName)
            );
        }

        case 'document-collection': {

            return (
                hasDocumentDatabaseEvidence(source) &&
                containsExactIdentifier(source, tableName)
            );
        }

        case 'relational-table': {

            return (
                hasRelationalDatabaseEvidence(source) &&
                containsExactIdentifier(source, tableName)
            );
        }

        case 'file-store': {

            return (
                containsExactIdentifier(source, tableName) &&
                hasPersistentFileEvidence(source)
            );
        }

        case 'unknown': {

            return containsExactIdentifier(combined, tableName);
        }

        default:
            return false;
    }
}


// --------------------------------------------------
// TECHNOLOGY VALIDATION
// --------------------------------------------------

function detectDatabaseTechnology(source: string): string {

    const technologies: string[] = [];

    if (hasVectorDatabaseEvidence(source)) {

        if (/\b(Chroma|ChromaDB)\b/i.test(source)) {
            technologies.push('Chroma');
        }

        if (/\bPinecone\b/i.test(source)) {
            technologies.push('Pinecone');
        }

        if (/\bQdrant\b/i.test(source)) {
            technologies.push('Qdrant');
        }

        if (/\bWeaviate\b/i.test(source)) {
            technologies.push('Weaviate');
        }

        if (/\bMilvus\b/i.test(source)) {
            technologies.push('Milvus');
        }

        if (/\bFAISS\b/i.test(source)) {
            technologies.push('FAISS');
        }

        if (/\bPGVector\b/i.test(source)) {
            technologies.push('PGVector');
        }
    }

    if (hasDocumentDatabaseEvidence(source)) {
        technologies.push('Document Database');
    }

    if (hasRelationalDatabaseEvidence(source)) {

        if (/sqlite/i.test(source)) {
            technologies.push('SQLite');
        }

        if (/postgres(?:ql)?/i.test(source)) {
            technologies.push('PostgreSQL');
        }

        if (/mysql/i.test(source)) {
            technologies.push('MySQL');
        }

        if (/mariadb/i.test(source)) {
            technologies.push('MariaDB');
        }

        if (
            !/sqlite|postgres(?:ql)?|mysql|mariadb/i.test(source)
        ) {
            technologies.push('SQL/ORM');
        }
    }

    return [...new Set(technologies)].join(', ') || 'Unknown';
}


// --------------------------------------------------
// MAIN VALIDATOR
// --------------------------------------------------

export function validateERAnalysis(
    analysis: ERAnalysis,
    project: WorkspaceSnapshot
): ERAnalysis {

    if (
        !analysis ||
        typeof analysis.overview !== 'string' ||
        !Array.isArray(analysis.entities) ||
        !Array.isArray(analysis.relationships)
    ) {
        throw new Error(
            'Invalid Database Storage Model analysis structure from Ollama.'
        );
    }

    const allowedStorageTypes = new Set([
        'relational-table',
        'vector-collection',
        'document-collection',
        'source-dataset',
        'file-store',
        'unknown'
    ]);

    const allowedRoles = new Set([
        'field',
        'document-id',
        'content',
        'embedding',
        'metadata'
    ]);

    const allowedRelationshipTypes = new Set([
        'one-to-one',
        'one-to-many',
        'many-to-many',
        'one-to-many-document',
        'unknown'
    ]);

    const allowedRelationshipKinds = new Set([
        'foreign-key',
        'application-mapping',
        'embedding-association',
        'data-ingestion',
        'collection-membership'
    ]);

    const entityIds = new Set<string>();

    // First normalize entity IDs and basic structures.
    for (const entity of analysis.entities) {

        if (
            !entity ||
            typeof entity.id !== 'string' ||
            typeof entity.name !== 'string' ||
            typeof entity.tableName !== 'string' ||
            typeof entity.description !== 'string' ||
            !entity.id.trim() ||
            !entity.name.trim() ||
            !entity.tableName.trim() ||
            !Array.isArray(entity.columns)
        ) {
            throw new Error(
                'Ollama returned a malformed storage entity.'
            );
        }

        const normalizedId = entity.id
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/^_+|_+$/g, '');

        if (!normalizedId || entityIds.has(normalizedId)) {
            throw new Error(
                `Invalid or duplicate storage entity ID: ${normalizedId}`
            );
        }

        entity.id = normalizedId;
        entity.name = entity.name.trim();
        entity.tableName = entity.tableName.trim();
        entity.description = entity.description.trim();

        if (!allowedStorageTypes.has(entity.storageType)) {
            entity.storageType = 'unknown';
        }

        const columnNames = new Set<string>();

        entity.columns = entity.columns.filter(column => {

            if (
                !column ||
                typeof column.name !== 'string' ||
                typeof column.dataType !== 'string' ||
                !column.name.trim() ||
                !column.dataType.trim()
            ) {
                return false;
            }

            const normalizedName = column.name
                .trim()
                .toLowerCase();

            if (columnNames.has(normalizedName)) {
                return false;
            }

            columnNames.add(normalizedName);

            column.name = column.name.trim();
            column.dataType = column.dataType.trim();

            column.isPrimaryKey = column.isPrimaryKey === true;
            column.isForeignKey = column.isForeignKey === true;
            column.isNullable = column.isNullable === true;
            column.isUnique = column.isUnique === true;

            if (!allowedRoles.has(column.role || 'field')) {
                column.role = 'field';
            }

            return true;
        });

        entityIds.add(normalizedId);
    }

    // Remove entities unsupported by the actual workspace.
    analysis.entities = analysis.entities.filter(entity =>
        hasEntityEvidence(entity, project)
    );

    // Rebuild IDs after unsupported entities have been removed.
    const verifiedEntityIds = new Set(
        analysis.entities.map(entity => entity.id)
    );

    // Replace CSV fields with actual detected CSV headers
    // whenever the scanner has supplied the dataset contents.
    for (const entity of analysis.entities) {

        if (entity.storageType !== 'source-dataset') {
            continue;
        }

        if (!/\.csv$/i.test(entity.tableName)) {
            continue;
        }

        const headers = extractCSVHeaders(
            getBaseName(entity.tableName),
            project.source || ''
        );

        if (headers.length > 0) {

            entity.columns = headers.map(name => ({
                name,
                dataType: 'CSV field',
                isPrimaryKey: false,
                isForeignKey: false,
                isNullable: false,
                isUnique: false,
                role: 'field'
            }));
        }
    }

    // Validate relationships against verified entities and fields.
    const uniqueRelationships = new Set<string>();

    analysis.relationships = analysis.relationships.filter(
        relationship => {

            if (
                !relationship ||
                typeof relationship.fromEntity !== 'string' ||
                typeof relationship.toEntity !== 'string' ||
                typeof relationship.fromColumn !== 'string' ||
                typeof relationship.toColumn !== 'string' ||
                typeof relationship.evidence !== 'string' ||
                !relationship.fromEntity.trim() ||
                !relationship.toEntity.trim() ||
                !relationship.fromColumn.trim() ||
                !relationship.toColumn.trim() ||
                !relationship.evidence.trim()
            ) {
                return false;
            }

            relationship.fromEntity = relationship.fromEntity
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, '_')
                .replace(/^_+|_+$/g, '');

            relationship.toEntity = relationship.toEntity
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, '_')
                .replace(/^_+|_+$/g, '');

            if (
                !verifiedEntityIds.has(relationship.fromEntity) ||
                !verifiedEntityIds.has(relationship.toEntity) ||
                relationship.fromEntity === relationship.toEntity ||
                !allowedRelationshipTypes.has(relationship.type) ||
                !allowedRelationshipKinds.has(relationship.kind)
            ) {
                return false;
            }

            const fromEntity = analysis.entities.find(
                entity => entity.id === relationship.fromEntity
            );

            const toEntity = analysis.entities.find(
                entity => entity.id === relationship.toEntity
            );

            const fromColumn = relationship.fromColumn.trim() === '*'
                ? undefined
                : fromEntity?.columns.find(
                    column =>
                        column.name.toLowerCase() ===
                        relationship.fromColumn.trim().toLowerCase()
                );

            const toColumn = toEntity?.columns.find(
                column =>
                    column.name.toLowerCase() ===
                    relationship.toColumn.trim().toLowerCase()
            );

            if (
                relationship.fromColumn.trim() === '*' &&
                relationship.kind !== 'data-ingestion'
            ) {
                return false;
            }

            if (
                relationship.fromColumn.trim() !== '*' &&
                !fromColumn
            ) {
                return false;
            }

            if (!toColumn) {
                return false;
            }

            const source = project.source || '';

            // Verify ingestion behavior against source code.
            if (relationship.kind === 'data-ingestion') {

                const hasReadOperation =
                    /\bread_csv\s*\(|\bread_json\s*\(|\bread_excel\s*\(|\bread_parquet\s*\(/i.test(source);

                const hasWriteOperation =
                    /\badd_documents\s*\(|\bfrom_documents\s*\(|\badd_texts\s*\(|\bupsert\s*\(/i.test(source);

                if (!hasReadOperation || !hasWriteOperation) {
                    return false;
                }
            }

            // Verify actual embedding generation or storage.
            if (relationship.kind === 'embedding-association') {

                const hasEmbeddingEvidence =
                    /\b(OllamaEmbeddings|OpenAIEmbeddings|HuggingFaceEmbeddings|embed_documents|embedding_function)\b/i.test(source);

                if (!hasEmbeddingEvidence) {
                    return false;
                }
            }

            // Enforce actual foreign-key constraints.
            if (relationship.kind === 'foreign-key') {

                if (
                    !fromColumn ||
                    (!fromColumn.isPrimaryKey && !fromColumn.isUnique) ||
                    !toColumn.isForeignKey
                ) {
                    return false;
                }

                relationship.type = toColumn.isUnique
                    ? 'one-to-one'
                    : 'one-to-many';
            }

            const key = [
                relationship.fromEntity,
                relationship.toEntity,
                relationship.fromColumn.toLowerCase(),
                relationship.toColumn.toLowerCase(),
                relationship.kind
            ].join('::');

            if (uniqueRelationships.has(key)) {
                return false;
            }

            uniqueRelationships.add(key);

            relationship.fromColumn =
                relationship.fromColumn.trim();

            relationship.toColumn =
                relationship.toColumn.trim();

            relationship.label = (
                typeof relationship.label === 'string' &&
                relationship.label.trim()
            )
                ? relationship.label.trim().slice(0, 100)
                : 'Data relationship';

            relationship.evidence =
                relationship.evidence.trim().slice(0, 250);

            return true;
        }
    );

    // Do not trust Ollama's technology list.
    // Derive it from explicit application-level evidence.
    analysis.databaseTechnology = detectDatabaseTechnology(
        project.source || ''
    );

    analysis.overview = analysis.overview.trim();

    if (analysis.entities.length === 0) {
        throw new Error(
            'No verifiable storage entities were detected. ' +
            'Check whether the project scanner included the relevant source files.'
        );
    }

    return analysis;
}
