
import {
    ERAnalysis,
    EREntity,
    ERColumn,
    DiagramDocument
} from '../utilities/types';

export function buildERDiagram(
    analysis: ERAnalysis
): DiagramDocument {

    const entities: DiagramDocument['entities'] = [];
    const connections: DiagramDocument['connections'] = [];

    const usedIds = new Set<string>();
    const entityIdMap = new Map<string, string>();

    const LEFT = 90;
    const TOP = 140;

    const ENTITY_WIDTH = 350;
    const ENTITY_GAP_X = 160;
    const ENTITY_GAP_Y = 100;

    const HEADER_HEIGHT = 48;
    const SUBHEADER_HEIGHT = 35;
    const COLUMN_HEIGHT = 30;
    const FOOTER_PADDING = 24;
    const METADATA_HEIGHT = 25;

    // --------------------------------------------------
    // UNIQUE ID GENERATION
    // --------------------------------------------------

    function createUniqueId(value: string): string {

        const base = value
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_')
            .replace(/^_+|_+$/g, '') || 'entity';

        let id = base;
        let suffix = 2;

        while (usedIds.has(id)) {
            id = `${base}_${suffix++}`;
        }

        usedIds.add(id);

        return id;
    }

    // --------------------------------------------------
    // STORAGE STYLES
    // --------------------------------------------------

    function getStorageStyle(storageType: EREntity['storageType']) {

        switch (storageType) {

            case 'relational-table':
                return {
                    color: '#e8f1ff',
                    titleColor: '#1d4ed8',
                    label: 'RELATIONAL TABLE'
                };

            case 'vector-collection':
                return {
                    color: '#f0eaff',
                    titleColor: '#7c3aed',
                    label: 'VECTOR DATABASE COLLECTION'
                };

            case 'document-collection':
                return {
                    color: '#e8f7ed',
                    titleColor: '#15803d',
                    label: 'DOCUMENT DATABASE COLLECTION'
                };

            case 'source-dataset':
                return {
                    color: '#fff3df',
                    titleColor: '#c2410c',
                    label: 'SOURCE DATASET'
                };

            case 'file-store':
                return {
                    color: '#edf0f4',
                    titleColor: '#475569',
                    label: 'PERSISTENT FILE STORAGE'
                };

            default:
                return {
                    color: '#f1f5f9',
                    titleColor: '#475569',
                    label: 'UNKNOWN STORAGE'
                };
        }
    }

    // --------------------------------------------------
    // EMBEDDING MODEL EXTRACTION
    // --------------------------------------------------

    function getEmbeddingModel(entity: EREntity): string | undefined {

        if (entity.storageType !== 'vector-collection') {
            return undefined;
        }

        const description = entity.description || '';

        const match = description.match(
            /(?:embedding\s+model|model)\s*[:=]\s*([a-zA-Z0-9._/-]+)/i
        );

        return match?.[1];
    }

    // --------------------------------------------------
    // ENTITY DIMENSIONS
    // --------------------------------------------------

    function getEntityHeight(entity: EREntity): number {

        const model = getEmbeddingModel(entity);

        return (
            HEADER_HEIGHT +
            SUBHEADER_HEIGHT +
            (model ? METADATA_HEIGHT : 0) +
            COLUMN_HEIGHT * Math.max(entity.columns.length, 1) +
            FOOTER_PADDING
        );
    }

    // --------------------------------------------------
    // COLUMN LABELS
    // --------------------------------------------------

    function getColumnLabel(column: ERColumn): string {

        const markers: string[] = [];

        // Document IDs are not automatically relational PKs.
        if (column.role === 'document-id') {
            markers.push('DOC ID');
        } else if (column.isPrimaryKey) {
            markers.push('PK');
        }

        if (column.isForeignKey) {
            markers.push('FK');
        }

        // Do not redundantly label document IDs as ordinary UQ fields.
        if (
            column.isUnique &&
            !column.isPrimaryKey &&
            column.role !== 'document-id'
        ) {
            markers.push('UQ');
        }

        const markerText = markers.length
            ? `[${markers.join(', ')}] `
            : '';

        const nullableText = column.isNullable
            ? 'NULL'
            : 'NOT NULL';

        let roleText = '';

        switch (column.role) {

            case 'document-id':
                roleText = ' (DOCUMENT ID - NOT SQL PK)';
                break;

            case 'embedding':
                roleText = ' (VECTOR EMBEDDING)';
                break;

            case 'metadata':
                roleText = ' (DOCUMENT METADATA)';
                break;

            case 'content':
                roleText = ' (DOCUMENT CONTENT)';
                break;

            default:
                break;
        }

        return (
            `${markerText}${column.name} : ${column.dataType}` +
            `${roleText} | ${nullableText}`
        );
    }

    // --------------------------------------------------
    // COLUMN COLORS
    // --------------------------------------------------

    function getColumnColor(column: ERColumn): string {

        if (column.isPrimaryKey) return '#1d4ed8';
        if (column.isForeignKey) return '#7c3aed';

        switch (column.role) {

            case 'embedding':
                return '#9333ea';

            case 'metadata':
                return '#0f766e';

            case 'document-id':
                return '#0369a1';

            case 'content':
                return '#475569';

            default:
                return '#334155';
        }
    }

    // --------------------------------------------------
    // POSITION ENTITIES
    // --------------------------------------------------

    if (analysis.entities.length === 0) {
        throw new Error(
            'Cannot build a storage diagram without entities.'
        );
    }

    const gridColumns = Math.max(
        1,
        Math.ceil(Math.sqrt(analysis.entities.length))
    );

    const rowHeights: number[] = [];

    for (
        let row = 0;
        row < Math.ceil(analysis.entities.length / gridColumns);
        row++
    ) {

        const rowEntities = analysis.entities.slice(
            row * gridColumns,
            (row + 1) * gridColumns
        );

        rowHeights.push(
            Math.max(...rowEntities.map(getEntityHeight))
        );
    }

    const rowYPositions: number[] = [];

    let currentY = TOP;

    for (const rowHeight of rowHeights) {

        rowYPositions.push(currentY);

        currentY += rowHeight + ENTITY_GAP_Y;
    }

    // --------------------------------------------------
    // CREATE STORAGE ENTITY SHAPES
    // --------------------------------------------------

    analysis.entities.forEach((entity, index) => {

        const row = Math.floor(index / gridColumns);
        const column = index % gridColumns;

        const x = LEFT + column * (
            ENTITY_WIDTH + ENTITY_GAP_X
        );

        const y = rowYPositions[row];

        const generatedId = createUniqueId(
            `er_${entity.id}`
        );

        entityIdMap.set(entity.id, generatedId);

        const style = getStorageStyle(entity.storageType);

        const height = getEntityHeight(entity);

        const embeddingModel = getEmbeddingModel(entity);

        const texts = [
            {
                text: entity.name.toUpperCase(),
                fontSize: 16,
                color: style.titleColor
            },
            {
                text: `${style.label} | ${entity.tableName}`,
                fontSize: 10,
                color: '#526174'
            },
            {
                text: entity.description.slice(0, 110),
                fontSize: 10,
                color: '#526174'
            },

            // Embedding model is collection metadata,
            // not a database column.
            ...(embeddingModel
                ? [{
                    text: `EMBEDDING MODEL | ${embeddingModel}`,
                    fontSize: 10,
                    color: '#7c3aed'
                }]
                : []),

            ...(entity.columns.length > 0
                ? entity.columns.map(column => ({
                    text: getColumnLabel(column),
                    fontSize: 10,
                    color: getColumnColor(column)
                }))
                : [{
                    text: 'No fields identified',
                    fontSize: 11,
                    color: '#64748b'
                }])
        ];

        entities.push({
            tag: 'Shape',
            id: generatedId,
            shape: 'rectangle',
            x,
            y,
            width: ENTITY_WIDTH,
            height,
            color: style.color,
            texts
        });
    });

    // --------------------------------------------------
    // CREATE STORAGE RELATIONSHIPS
    // --------------------------------------------------

    const relationshipKeys = new Set<string>();

    const cardinalityLabels: Record<string, string> = {
        'one-to-one': '1 : 1',
        'one-to-many': '1 : N',
        'many-to-many': 'M : N',
        'one-to-many-document': '1 : N DOC',
        'unknown': 'UNKNOWN'
    };

    const relationshipKindLabels: Record<string, string> = {
        'foreign-key': 'FOREIGN KEY',
        'application-mapping': 'APPLICATION MAPPING',
        'embedding-association': 'EMBEDDING ASSOCIATION',
        'data-ingestion': 'DATA INGESTION',
        'collection-membership': 'COLLECTION MEMBERSHIP'
    };

    for (const relationship of analysis.relationships) {

        const from = entityIdMap.get(
            relationship.fromEntity
        );

        const to = entityIdMap.get(
            relationship.toEntity
        );

        if (!from || !to || from === to) {
            continue;
        }

        const key = [
            from,
            to,
            relationship.fromColumn,
            relationship.toColumn,
            relationship.kind
        ].join('::');

        if (relationshipKeys.has(key)) {
            continue;
        }

        relationshipKeys.add(key);

        const cardinality =
            cardinalityLabels[relationship.type] || 'UNKNOWN';

        const kind =
            relationshipKindLabels[relationship.kind] ||
            'DATA RELATIONSHIP';

        const label = [
            kind,
            cardinality,
            `${relationship.fromColumn} → ${relationship.toColumn}`,
            relationship.label
        ].join(' | ').slice(0, 140);

        connections.push({
            from,
            to,
            endArrowhead: 'triangle',
            label
        });
    }

    // --------------------------------------------------
    // VALIDATE DIAGRAM
    // --------------------------------------------------

    const ids = entities.map(entity => entity.id);

    if (new Set(ids).size !== ids.length) {
        throw new Error(
            'ER Diagram contains duplicate entity IDs.'
        );
    }

    for (const connection of connections) {

        if (
            !ids.includes(connection.from) ||
            !ids.includes(connection.to)
        ) {
            throw new Error(
                'ER Diagram contains an invalid relationship.'
            );
        }
    }

    console.log(
        '[DocFlowAI] Database Storage Diagram:',
        entities.length,
        'entities,',
        connections.length,
        'relationships.'
    );

    return {
        entities,
        connections,
        outputs: {
            png: true,
            json: true
        }
    };
}
