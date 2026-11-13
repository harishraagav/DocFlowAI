
import {
    ArchitectureAnalysis,
    DiagramDocument
} from '../utilities/types';

export function buildComponentDiagram(
    analysis: ArchitectureAnalysis
): DiagramDocument {

    const entities: DiagramDocument['entities'] = [];
    const connections: DiagramDocument['connections'] = [];

    const usedIds = new Set<string>();
    const componentIdMap = new Map<string, string>();

    // Improved layout dimensions.
    const COLUMN_WIDTH = 390;
    const COLUMN_GAP = 190;
    const COMPONENT_WIDTH = 340;
    const COMPONENT_HEIGHT = 135;
    const COMPONENT_GAP = 45;

    const LEFT = 60;
    const TOP = 100;

    const LAYER_COLORS = [
        'blue',
        'purple',
        'green',
        'orange',
        'yellow',
        'red'
    ];

    function createUniqueId(value: string): string {
        const base = value
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_')
            .replace(/^_+|_+$/g, '') || 'component';

        let id = base;
        let suffix = 2;

        while (usedIds.has(id)) {
            id = `${base}_${suffix++}`;
        }

        usedIds.add(id);
        return id;
    }

    // Keep relationship labels concise and readable.
    function formatConnectionLabel(value: string): string {
        let label = value
            .replace(/\s+/g, ' ')
            .trim();

        const replacements: Array<[RegExp, string]> = [
            [/sends? http requests?/gi, 'HTTP requests'],
            [/retrieves? vector embeddings?/gi, 'Vector retrieval'],
            [/stores? vector embeddings?/gi, 'Vector storage'],
            [/provides? text generation capabilities/gi, 'Text generation'],
            [/provides? semantic search capabilities/gi, 'Semantic search'],
            [/communicates? with/gi, 'Communication'],
            [/fetches? data from/gi, 'Data retrieval'],
            [/writes? data to/gi, 'Data write'],
            [/reads? data from/gi, 'Data read'],
            [/authenticates? users?/gi, 'User authentication'],
            [/manages? user sessions?/gi, 'Session management'],
            [/processes? requests?/gi, 'Request processing']
        ];

        for (const [pattern, replacement] of replacements) {
            label = label.replace(pattern, replacement);
        }

        // Remove unnecessary filler words.
        label = label
            .replace(/\b(the|a|an|that|which)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Keep labels compact for connector readability.
        const MAX_LABEL_LENGTH = 28;

        if (label.length > MAX_LABEL_LENGTH) {
            label = label.slice(0, MAX_LABEL_LENGTH - 3).trimEnd() + '...';
        }

        return label || 'Dependency';
    }

    // --------------------------------------------------
    // BUILD LAYERS AND COMPONENTS
    // --------------------------------------------------

    analysis.layers.forEach((layer, layerIndex) => {

        const x = LEFT + layerIndex * (
            COLUMN_WIDTH + COLUMN_GAP
        );

        const componentCount = layer.components.length;

        const layerHeight = Math.max(
            260,
            165 + componentCount * (
                COMPONENT_HEIGHT + COMPONENT_GAP
            )
        );

        const groupId = createUniqueId(
            `component_layer_${layerIndex + 1}`
        );

        entities.push({
            tag: 'Group',
            id: groupId,
            title: {
                text: layer.name
            },
            x,
            y: TOP,
            width: COLUMN_WIDTH,
            height: layerHeight,
            color: LAYER_COLORS[
                layerIndex % LAYER_COLORS.length
            ]
        });

        layer.components.forEach((component, index) => {

            const generatedId = createUniqueId(component.id);

            componentIdMap.set(
                component.id,
                generatedId
            );

            const componentX = x + (
                COLUMN_WIDTH - COMPONENT_WIDTH
            ) / 2;

            const componentY = TOP + 85 + index * (
                COMPONENT_HEIGHT + COMPONENT_GAP
            );

            entities.push({
                tag: 'Shape',
                id: generatedId,
                shape: 'rectangle',
                x: componentX,
                y: componentY,
                width: COMPONENT_WIDTH,
                height: COMPONENT_HEIGHT,
                containerId: groupId,
                color: 'white',
                texts: [
                    {
                        text: `«component» ${component.name}`,
                        fontSize: 15
                    },
                    {
                        text: component.technology || 'Unknown',
                        fontSize: 12,
                        color: '#526174'
                    },
                    {
                        text: component.description,
                        fontSize: 11,
                        color: '#526174'
                    }
                ]
            });
        });
    });

    // --------------------------------------------------
    // BUILD CONNECTIONS
    // --------------------------------------------------

    const connectionKeys = new Set<string>();

    for (const connection of analysis.connections) {

        const from = componentIdMap.get(connection.from);
        const to = componentIdMap.get(connection.to);

        if (!from || !to || from === to) {
            continue;
        }

        const key = `${from}::${to}`;

        if (connectionKeys.has(key)) {
            continue;
        }

        connectionKeys.add(key);

        connections.push({
            from,
            to,
            endArrowhead: 'triangle',
            label: formatConnectionLabel(
                connection.label || 'Dependency'
            )
        });
    }

    // --------------------------------------------------
    // VALIDATE ENTITY IDS
    // --------------------------------------------------

    const ids = entities.map(entity => entity.id);

    if (new Set(ids).size !== ids.length) {
        throw new Error(
            'Component diagram contains duplicate entity IDs.'
        );
    }

    console.log(
        '[DocFlowAI] Component diagram:',
        entities.length,
        'entities,',
        connections.length,
        'connections.'
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
