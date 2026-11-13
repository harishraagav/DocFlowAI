
export interface Component {
    id: string;
    name: string;
    technology: string;
    description: string;
}

export interface ArchitectureLayer {
    name: string;
    components: Component[];
}

export interface ArchitectureConnection {
    from: string;
    to: string;
    label: string;
}

export interface ArchitectureAnalysis {
    overview: string;
    layers: ArchitectureLayer[];
    connections: ArchitectureConnection[];
    dataFlow: string[];
}

export interface WorkspaceSnapshot {
    tree: string;
    source: string;
    fileCount: number;
    totalCharacters: number;
}

export interface DiagramDocument {
    entities: Array<{
        tag: string;
        id: string;
        [key: string]: any;
    }>;
    connections: Array<{
        from: string;
        to: string;
        [key: string]: any;
    }>;
    outputs?: {
        png?: boolean;
        json?: boolean;
    };
}


export type DataFlowNodeType =
    | 'external'
    | 'process'
    | 'datastore';

export interface DataFlowNode {
    id: string;
    name: string;
    type: DataFlowNodeType;
    description: string;
    technology: string;
}

export interface DataFlowConnection {
    from: string;
    to: string;
    label: string;
    data: string;
}

export interface DataFlowAnalysis {
    overview: string;
    nodes: DataFlowNode[];
    flows: DataFlowConnection[];
}


export interface SequenceParticipant {
    id: string;
    name: string;
    technology: string;
    type: string;
}

export interface SequenceMessage {
    from: string;
    to: string;
    label: string;
    type: 'sync' | 'async' | 'return';
}

export interface SequenceAnalysis {
    overview: string;
    participants: SequenceParticipant[];
    messages: SequenceMessage[];
}


export type ERStorageType =
    | 'relational-table'
    | 'vector-collection'
    | 'document-collection'
    | 'source-dataset'
    | 'file-store'
    | 'unknown';

export type ERRelationshipType =
    | 'one-to-one'
    | 'one-to-many'
    | 'many-to-many'
    | 'one-to-many-document'
    | 'unknown';

export type ERRelationshipKind =
    | 'foreign-key'
    | 'application-mapping'
    | 'embedding-association'
    | 'data-ingestion'
    | 'collection-membership';

export interface ERColumn {
    name: string;
    dataType: string;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    isNullable: boolean;
    isUnique: boolean;
    role?: 'field' | 'document-id' | 'content' | 'embedding' | 'metadata';
}

export interface ERRelationship {
    fromEntity: string;
    toEntity: string;
    fromColumn: string;
    toColumn: string;
    type: ERRelationshipType;
    kind: ERRelationshipKind;
    label: string;
    evidence: string;
}

export interface EREntity {
    id: string;
    name: string;
    tableName: string;
    description: string;
    storageType: ERStorageType;
    columns: ERColumn[];
}

export interface ERAnalysis {
    overview: string;
    databaseTechnology: string;
    entities: EREntity[];
    relationships: ERRelationship[];
}


export interface ProjectModule {
    name: string;
    path: string;
    responsibility: string;
    technologies: string[];
}

export interface ProjectEntryPoint {
    name: string;
    path: string;
    purpose: string;
}

export interface ProjectOverview {
    projectName: string;
    projectType: string;
    purpose: string;
    architectureSummary: string;
    primaryTechnologies: string[];
    modules: ProjectModule[];
    entryPoints: ProjectEntryPoint[];
    executionFlow: string[];
    keyFiles: string[];
    observations: string[];
}

export interface TechnologyStackItem {
    name: string;
    category: string;
    purpose: string;
    evidence: string[];
    confidence: 'high' | 'medium' | 'low';
}

export interface TechnologyStackAnalysis {
    projectName: string;
    summary: string;
    technologies: TechnologyStackItem[];
    observations: string[];
}

export interface ApiEndpoint {
    name: string;
    method: string;
    path: string;
    kind: 'server-route' | 'client-request';
    handler: string;
    file: string;
    purpose: string;
    requestParameters: string[];
    requestBodyFields: string[];
    responseDescription: string;
    authentication: string;
    evidence: string[];
}

export interface ApiDependency {
    sourceEndpoint: string;
    targetEndpoint: string;
    description: string;
}

export interface ApiDiscoveryAnalysis {
    projectName: string;
    summary: string;
    endpoints: ApiEndpoint[];
    dependencies: ApiDependency[];
    observations: string[];
}

export interface DependencyItem {
    name: string;
    version: string;
    category: 'runtime' | 'development' | 'optional' | 'unknown';
    ecosystem: string;
    sourceFile: string;
}

export interface InternalModuleDependency {
    sourceFile: string;
    targetModule: string;
    importStatement: string;
}

export interface DependencyAnalysis {
    projectName: string;
    summary: string;
    dependencies: DependencyItem[];
    internalDependencies: InternalModuleDependency[];
    observations: string[];
}

export interface CodeQualityFinding {
    title: string;
    description: string;
    severity: 'high' | 'medium' | 'low' | 'info';
    category: string;
    file: string;
    line: number;
    evidence: string;
    recommendation: string;
}

export interface CodeQualityAnalysis {
    projectName: string;
    summary: string;
    findings: CodeQualityFinding[];
    observations: string[];
    filesAnalyzed: number;
}

export interface ChangeImpactItem {
    file: string;
    depth: number;
    dependencyChain: string[];
}

export interface ChangeImpactAnalysis {
    projectName: string;
    changedFile: string;
    summary: string;
    directDependents: ChangeImpactItem[];
    transitiveDependents: ChangeImpactItem[];
    observations: string[];
}
