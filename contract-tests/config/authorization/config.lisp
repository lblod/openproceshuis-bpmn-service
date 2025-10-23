;;;;;;;;;;;;;;;;;;;
;;; Delta messenger

(in-package :delta-messenger)

(setf *delta-handlers* nil)
(add-delta-logger)
(add-delta-messenger "http://deltanotifier/")

;;;;;;;;;;;;;;;;;
;;; Configuration

(in-package :client)
(setf *log-sparql-query-roundtrip* t)
(setf *backend* "http://virtuoso:8890/sparql")

(in-package :server)
(setf *log-incoming-requests-p* t)

;;;;;;;;;;;;;;;;
;;; Prefix types

(in-package :type-cache)
(add-type-for-prefix "http://mu.semte.ch/sessions/" "http://mu.semte.ch/vocabularies/session/Session")

;;;;;;;;;;;;;;;;;
;;; Access rights

(in-package :acl)

;;;;;;;;;;;;;;;;
;;; Prefixes

(define-prefixes
  :mu "http://mu.semte.ch/vocabularies/core/"
  :session "http://mu.semte.ch/vocabularies/session/"
  :ext "http://mu.semte.ch/vocabularies/ext/"
  :besluit "http://data.vlaanderen.be/ns/besluit#"
  :organisatie "http://lblod.data.gift/vocabularies/organisatie/"
  :schema "http://schema.org/"
  :cogs "http://vocab.deri.ie/cogs#"
  :nfo "http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#"
  :skos "http://www.w3.org/2004/02/skos/core#"
  :org "http://www.w3.org/ns/org#"
  :foaf "http://xmlns.com/foaf/0.1/"
  :bbo "https://www.irit.fr/recherches/MELODI/ontologies/BBO#"
  :bboext "https://www.teamingai-project.eg/BBOExtension#"
  :reporting "http://lblod.data.gift/vocabularies/reporting/"
  :ipdc "https://productencatalogus.data.vlaanderen.be/ns/ipdc-lpdc#"
  :dpv "https://w3id.org/dpv#")

;;;;;;;;;;;;;
;;; User roles

(supply-allowed-group "public")

(supply-allowed-group "shared-processes-reader"
  :query "PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
          PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
          PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
          SELECT DISTINCT ?session_group WHERE {
            <SESSION_ID> ext:sessionGroup ?session_group.
            ?session_group mu:uuid ?uuid.
          }")

(supply-allowed-group "organization-processes-editor"
  :parameters ("graph_extension")
  :query "PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
          PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
          PREFIX dct: <http://purl.org/dc/terms/>
          SELECT DISTINCT ?graph_extension WHERE {
            {
              <SESSION_ID> ext:sessionGroup ?group ;
                          ext:sessionRole ?role .
              ?group mu:uuid ?group_id ;
                     dct:identifier ?identifier .
            } UNION {
              <SESSION_ID> ext:originalSessionGroup ?group ;
                          ext:originalSessionRole ?role .
              ?group mu:uuid ?group_id ;
                     dct:identifier ?identifier .
            }
            FILTER(?role IN (\"LoketLB-OpenProcesHuisGebruiker\", \"LoketLB-OpenProcesHuisAfnemer\"))
            BIND(IF(?identifier IN (\"OVO001835\", \"OVO002949\"),
                    \"agentschap-binnenlands-bestuur-digitaal-vlaanderen\",
                    ?group_id) AS ?graph_extension)
          }")

(supply-allowed-group "shared-processes-editor"
  :query "PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
          PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
          SELECT DISTINCT ?session_group WHERE {
            {
              <SESSION_ID> ext:sessionGroup/mu:uuid ?session_group;
                           ext:sessionRole ?role.
              FILTER(?role IN (\"LoketLB-OpenProcesHuisGebruiker\", \"LoketLB-OpenProcesHuisAfnemer\"))
            } UNION {
              <SESSION_ID> ext:originalSessionGroup/mu:uuid ?session_group;
                           ext:originalSessionRole ?role.
              FILTER(?role IN (\"LoketLB-OpenProcesHuisGebruiker\", \"LoketLB-OpenProcesHuisAfnemer\"))
            }
          }")
          
(supply-allowed-group "admin"
  :query "PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
          SELECT DISTINCT ?session_role WHERE {
            VALUES ?session_role {
              \"LoketLB-admin\"
            }
            {
              <SESSION_ID> ext:sessionRole ?session_role.
            } UNION {
              <SESSION_ID> ext:originalSessionRole ?session_role.
            }
          }
          LIMIT 1")

(grant (read)
       :to-graph public
       :for-allowed-group "public")
       
(grant (read)
       :to-graph shared
       :for-allowed-group "shared-processes-reader")

(grant (read)
       :to-graph job
       :for-allowed-group "public")

(grant (read write)
       :to-graph statistics
       :for-allowed-group "public")

(grant (read write)
       :to-graph organizations
       :for-allowed-group "organization-processes-editor")

(grant (read write)
       :to-graph shared
       :for-allowed-group "shared-processes-editor")

(grant (read write)
       :to-graph sessions
       :for-allowed-group "admin")

(grant (read)
       :to-graph reports
       :for-allowed-group "admin")

;;;;;;;;;
;;; Graphs

(define-graph shared ("http://mu.semte.ch/graphs/shared")
  ;; bpmn-element-type
  ("bbo:Activity" -> _)
  ("bbo:BoundaryEvent" -> _)
  ("bbo:BusinessRuleTask" -> _)
  ("bbo:CallableElement" -> _)
  ("bbo:CatchEvent" -> _)
  ("bbo:EndEvent" -> _)
  ("bbo:Error" -> _)
  ("bbo:ErrorEventDefinition" -> _)
  ("bbo:Event" -> _)
  ("bbo:EventDefinition" -> _)
  ("bbo:ExclusiveGateway" -> _)
  ("bbo:FlowElement" -> _)
  ("bbo:FlowElementsContainer" -> _)
  ("bbo:FlowNode" -> _)
  ("bbo:Gateway" -> _)
  ("bbo:InclusiveGateway" -> _)
  ("bbo:IntermediateThrowEvent" -> _)
  ("bbo:ManualTask" -> _)
  ("bbo:MessageEventDefinition" -> _)
  ("bbo:ParallelGateway" -> _)
  ("bbo:Process" -> _)
  ("bbo:Property" -> _)
  ("bbo:ReceiveTask" -> _)
  ("bbo:RootElement" -> _)
  ("bbo:ScriptTask" -> _)
  ("bbo:SendTask" -> _)
  ("bbo:SequenceFlow" -> _)
  ("bbo:ServiceTask" -> _)
  ("bbo:StartEvent" -> _)
  ("bbo:SubProcess" -> _)
  ("bbo:Task" -> _)
  ("bbo:ThrowEvent" -> _)
  ("bbo:UserTask" -> _)
  ("bboext:Collaboration" -> _)
  ("bboext:DataObject" -> _)
  ("bboext:DataObjectReference" -> _)
  ("bboext:Lane" -> _)
  ("bboext:LaneSet" -> _)
  ("bboext:Participant" -> _)
  ;; process-type
  ("dpv:Process" x> "ext:hasStatistics")
  ("nfo:FileDataObject" -> _)
  ("ipdc:InstancePublicService" -> _)
  ("ipdc:ConceptualPublicService" -> _)
  ("skos:Concept" -> _))

(define-graph organizations ("http://mu.semte.ch/graphs/organizations/")
  ;; bpmn-element-type
  ("bbo:Activity" -> _)
  ("bbo:BoundaryEvent" -> _)
  ("bbo:BusinessRuleTask" -> _)
  ("bbo:CallableElement" -> _)
  ("bbo:CatchEvent" -> _)
  ("bbo:EndEvent" -> _)
  ("bbo:Error" -> _)
  ("bbo:ErrorEventDefinition" -> _)
  ("bbo:Event" -> _)
  ("bbo:EventDefinition" -> _)
  ("bbo:ExclusiveGateway" -> _)
  ("bbo:FlowElement" -> _)
  ("bbo:FlowElementsContainer" -> _)
  ("bbo:FlowNode" -> _)
  ("bbo:Gateway" -> _)
  ("bbo:InclusiveGateway" -> _)
  ("bbo:IntermediateThrowEvent" -> _)
  ("bbo:ManualTask" -> _)
  ("bbo:MessageEventDefinition" -> _)
  ("bbo:ParallelGateway" -> _)
  ("bbo:Process" -> _)
  ("bbo:Property" -> _)
  ("bbo:ReceiveTask" -> _)
  ("bbo:RootElement" -> _)
  ("bbo:ScriptTask" -> _)
  ("bbo:SendTask" -> _)
  ("bbo:SequenceFlow" -> _)
  ("bbo:ServiceTask" -> _)
  ("bbo:StartEvent" -> _)
  ("bbo:SubProcess" -> _)
  ("bbo:Task" -> _)
  ("bbo:ThrowEvent" -> _)
  ("bbo:UserTask" -> _)
  ("bboext:Collaboration" -> _)
  ("bboext:DataObject" -> _)
  ("bboext:DataObjectReference" -> _)
  ("bboext:Lane" -> _)
  ("bboext:LaneSet" -> _)
  ("bboext:Participant" -> _)
  ;; process-type
  ("dpv:Process" x> "ext:hasStatistics")
  ("nfo:FileDataObject" -> _)
  ("ipdc:InstancePublicService" -> _)
  ("ipdc:ConceptualPublicService" -> _)
  ("skos:Concept" -> _))

(define-graph public ("http://mu.semte.ch/graphs/public")
  ("besluit:Bestuurseenheid" -> _)
  ("foaf:Person" -> _)
  ("foaf:OnlineAccount" -> _)
  ("skos:Concept" -> _)
  ("org:Organization" -> _)
  ("org:Site" -> _)
  ("schema:ContactPoint" -> _)
  ("organisatie:TypeVestiging" -> _)
  ("organisatie:BestuurseenheidClassificatieCode" -> _)
  ("organisatie:OrganisatieStatusCode" -> _)
  ("skos:ConceptScheme" -> _))

(define-graph job ("http://mu.semte.ch/graphs/bpmn-job")
  ("cogs:Job" -> _))

(define-graph sessions ("http://mu.semte.ch/graphs/sessions")
  ("session:Session" -> _))

(define-graph reports ("http://mu.semte.ch/graphs/reports")
  ("reporting:Report" -> _)
  ("nfo:FileDataObject" -> _))

(define-graph statistics ("http://mu.semte.ch/graphs/statistics")
  ("ext:ProcessStatistic" -> _)
  ("dpv:Process" -> "ext:hasStatistics"))
