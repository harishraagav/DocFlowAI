
import {
    DataFlowAnalysis,
    DiagramDocument,
    DataFlowNode
} from '../utilities/types';

export function buildDataFlowDiagram(
    analysis: DataFlowAnalysis
): DiagramDocument {

    const entities: DiagramDocument['entities'] = [];
    const connections: DiagramDocument['connections'] = [];

    const usedIds = new Set<string>();
    const nodeIdMap = new Map<string, string>();

    const LEFT = 70;
    const TOP = 120;

    const COLUMN_WIDTH = 340;
    const COLUMN_GAP = 170;

    const NODE_WIDTH = 280;
    const NODE_HEIGHT = 125;
    const NODE_GAP = 65;

    const columns = [
        {
            type: 'external',
            title: 'External Entities',
            color: 'blue'
        },
        {
            type: 'process',
            title: 'Data Processing',
            color: 'purple'
        },
        {
            type: 'datastore',
            title: 'Data Stores',
            color: 'green'
        }
    ];

    function createUniqueId(value: string): string {

        const base = value
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_')
            .replace(/^_+|_+$/g, '') || 'node';

        let id = base;
        let suffix = 2;

        while (usedIds.has(id)) {
            id = `${base}_${suffix++}`;
        }

        usedIds.add(id);

        return id;
    }

    function getNodeColor(type: string): string {
        switch (type) {
            case 'external':
                return '#eaf2ff';
            case 'process':
                return '#f1eaff';
            case 'datastore':
                return '#e8f7ed';
            default:
                return 'white';
        }
    }

    function getNodeLabel(type: string): string {
        switch (type) {
            case 'external':
                return '«external entity»';
            case 'process':
                return '«process»';
            case 'datastore':
                return '«data store»';
            default:
                return '«data element»';
        }
    }

    // --------------------------------------------------
    // GROUP NODES INTO THREE COLUMNS
    // --------------------------------------------------

    const groupedNodes: Record<string, DataFlowNode[]> = {
        external: [],
        process: [],
        datastore: []
    };

    for (const node of analysis.nodes) {
        groupedNodes[node.type].push(node);
    }

    const maxColumnNodes = Math.max(
        1,
        ...Object.values(groupedNodes).map(nodes => nodes.length)
    );

    const diagramHeight = Math.max(
        360,
        maxColumnNodes * (NODE_HEIGHT + NODE_GAP) + 190
    );

    // --------------------------------------------------
    // CREATE COLUMN GROUPS AND NODE SHAPES
    // --------------------------------------------------

    columns.forEach((column, columnIndex) => {

        const x = LEFT + columnIndex * (
            COLUMN_WIDTH + COLUMN_GAP
        );

        const groupId = createUniqueId(
            `dfd_${column.type}_group`
        );

        entities.push({
            tag: 'Group',
            id: groupId,
            title: {
                text: column.title
            },
            x,
            y: 65,
            width: COLUMN_WIDTH,
            height: diagramHeight,
            color: column.color
        });

        const nodes = groupedNodes[column.type];

        nodes.forEach((node, nodeIndex) => {

            const generatedId = createUniqueId(node.id);

            nodeIdMap.set(node.id, generatedId);

            const nodeX = x + (
                COLUMN_WIDTH - NODE_WIDTH
            ) / 2;

            const nodeY = TOP + nodeIndex * (
                NODE_HEIGHT + NODE_GAP
            );

            entities.push({
                tag: 'Shape',
                id: generatedId,
                shape: 'rectangle',
                x: nodeX,
                y: nodeY,
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
                containerId: groupId,
                color: getNodeColor(node.type),
                texts: [
                    {
                        text: `${getNodeLabel(node.type)} ${node.name}`,
                        fontSize: 14
                    },
                    {
                        text: node.technology || 'Unknown',
                        fontSize: 11,
                        color: '#526174'
                    },
                    {
                        text: node.description,
                        fontSize: 10,
                        color: '#526174'
                    }
                ]
            });
        });
    });

    // --------------------------------------------------
    // CREATE DATA FLOWS
    // --------------------------------------------------

    const connectionKeys = new Set<string>();

    for (const flow of analysis.flows) {

        const from = nodeIdMap.get(flow.from);
        const to = nodeIdMap.get(flow.to);

        if (!from || !to || from === to) {
            continue;
        }

        const key = `${from}::${to}`;

        if (connectionKeys.has(key)) {
            continue;
        }

        connectionKeys.add(key);

        const label = (flow.label || 'Data transfer')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 28);

        connections.push({
            from,
            to,
            endArrowhead: 'triangle',
            label
        });
    }

    // --------------------------------------------------
    // VALIDATE
    // --------------------------------------------------

    const ids = entities.map(entity => entity.id);

    if (new Set(ids).size !== ids.length) {
        throw new Error(
            'Data Flow diagram contains duplicate entity IDs.'
        );
    }

    for (const connection of connections) {
        if (
            !ids.includes(connection.from) ||
            !ids.includes(connection.to)
        ) {
            throw new Error(
                'Data Flow diagram contains an invalid connection.'
            );
        }
    }

    console.log(
        '[DocFlowAI] Data Flow Diagram:',
        entities.length,
        'entities,',
        connections.length,
        'flows.'
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
