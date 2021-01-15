import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import '../App.scss';
import { observer } from 'mobx-react-lite'
import { toJS } from 'mobx'
import useDebounce from '../utils/useDebounce'
import { vegaPlugins } from 'vega-widgets'
import './bitqueditor/App.scss'
import getQueryFacts from '../utils/getQueryFacts'
import GraphqlEditor from './bitqueditor/components/GraphqlEditor'
import { getIntrospectionQuery, buildClientSchema, TypeInfo, visitWithTypeInfo } from 'graphql'
import { visit } from 'graphql/language/visitor'
import { parse as parseGql } from 'graphql/language'
import JsonPlugin from './bitqueditor/components/JsonWidget'
import ToolbarComponent from './bitqueditor/components/ToolbarComponent'
import { TabsStore, QueriesStore, UserStore } from '../store/queriesStore'
import WidgetEditorControls from './WidgetEditorControls'
import { getValueFrom, getLeft } from '../utils/common'

const EditorInstance = observer(function EditorInstance({number})  {
	const { tabs, currentTab, index, id } = TabsStore
	const { user }  = UserStore
	const { query, updateQuery, showGallery, currentQuery } = QueriesStore
	const [schema, setSchema] = useState(null)
	const [widgetType, setWidgetType] = useState('')
	const [_variableToType, _setVariableToType] = useState(null)
	const [queryTypes, setQueryTypes] = useState('')
	const [dataSource, setDataSource] = useState({})
	const [dataModel, setDataModel] = useState('')
	const debouncedURL = useDebounce(query[index].endpoint_url, 500)
	const workspace = useRef(null)
	const overwrap = useRef(null)
	const executeButton = useRef(null)
	useEffect(() => {
		dataModel && setDataModel('')
		if (queryTypes && currentQuery.displayed_data) {
			for (let node in queryTypes) {
				node.includes(currentQuery.displayed_data) &&
					setDataModel(prev => {return {...prev, [node]: queryTypes[node]}})
			}
		}
	}, [queryTypes, currentQuery.displayed_data])
	const handleResizer = e => {
		if (e.target.className.indexOf('sizeChanger') !== 0) {
			return
		}
		e.preventDefault()
		const onMouseUp = () => {
			overwrap.current.removeEventListener('mousemove', onMouseMove)
			overwrap.current.removeEventListener('mouseup', onMouseUp)
		}
		const onMouseMove = e => {
			if (e.buttons === 0) {
				return onMouseUp()
			}
			const leftSize = e.clientX - getLeft(overwrap.current) 
			const rightSize = overwrap.current.clientWidth - leftSize
			let flex = leftSize / rightSize
			workspace.current.setAttribute('style', `flex: ${flex} 1 0%;`)
			let execButt = workspace.current.offsetWidth / overwrap.current.offsetWidth
			executeButton.current.setAttribute('style', `left: calc(${execButt*100}% - 25px);`)
		}
		overwrap.current.addEventListener('mousemove', onMouseMove);
    	overwrap.current.addEventListener('mouseup', onMouseUp);
	}
	const getQueryTypes = (query) => {
		const typeInfo = new TypeInfo(schema)
		let typesMap = {}
		const queryNodes = []
		let depth = 0
		let visitor = {
			enter(node ) {
				typeInfo.enter(node)
				let name = ''
				if (node.name) {
					if (node.name.value) name = node.name.value
				}
				if(node.kind === "Field") {
					if (node.alias) {
						queryNodes.push(node.alias.value)
					} else {
						queryNodes.push(typeInfo.getFieldDef().name)
					}
					if (depth) {
						let arr = queryNodes.filter(node=> node.split('.').length === depth)
						let index = queryNodes.indexOf(arr[arr.length-1])
						let depthLength = depth!==1 ? index : 0
						queryNodes[queryNodes.length-1] = 
							queryNodes[depthLength]+'.'+queryNodes[queryNodes.length-1]
					}
					if (typeInfo.getType().toString()[0] === '[') {
						if (node.selectionSet.selections.length === 1) {
							queryNodes[queryNodes.length-1] = `${queryNodes[queryNodes.length-1]}[0]`
						}
					}
					typesMap[queryNodes[queryNodes.length-1]] = typeInfo.getType().toString()
					depth++
				}
			},
			leave(node) {
				if (node.kind === 'Field') {
					depth--
				}
				typeInfo.leave(node)
			}
		}
		try {
			visit(parseGql(query), visitWithTypeInfo(typeInfo, visitor))
		} catch (e) {}
		return typesMap
	}
	const getResult = async () => {
		const data = await fetcher({query: query[index].query, variables: query[index].variables})
		data.json().then(json => {
			setDataSource({
				execute: getResult,
				data: ('data' in json) ? json.data : null,
				values: ('data' in json) ? (currentQuery.displayed_data) ? getValueFrom(json.data, currentQuery.displayed_data) : json.data : null,
				error: ('errors' in json) ? json.errors : null,
				query: toJS(query[index].query), 
				variables: toJS(query[index].variables)
			})
			if (!('data' in json)) updateQuery({widget_id: 'json.widget'}, index)
		})
		let queryType = getQueryTypes(query[index].query)
		if (JSON.stringify(queryType) !== JSON.stringify(queryTypes)) {
			setQueryTypes(queryType)
		}
	}
	const editQueryHandler = useCallback(handleSubject => {
			if ('query' in handleSubject) {
				const facts = getQueryFacts(schema, handleSubject.query)
				if (facts) {
					const { variableToType } = facts
					if ((JSON.stringify(variableToType) !== JSON.stringify(_variableToType)) 
						&& _variableToType!==null) {
						_setVariableToType(variableToType)
					}
				}
				let queryType = getQueryTypes(handleSubject.query)
				if (JSON.stringify(queryType) !== JSON.stringify(queryTypes)) {
					setQueryTypes(queryType)
				}
			}
			if (user && query[index].account_id === user.id ) {
				updateQuery(handleSubject, index)
			} else {
				updateQuery({...handleSubject, url: null}, index, null)
			}
	}, [user, schema, queryTypes])
	useEffect(() => {
		if (number === index && schema) {
			let queryType = getQueryTypes(query[index].query)
			setQueryTypes(queryType)
		}
	}, [schema])
	const setConfig = (config) => {
		if (number === index) {
			if (JSON.stringify(currentQuery.config) !== JSON.stringify(config)) {
				updateQuery({config, widget_id: widgetType}, index)
			}
		}
	}
	const fetcher = (graphQLParams) => {
		return fetch(
			query[index].endpoint_url,
			{
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(graphQLParams),
				credentials: 'same-origin',
			},
		)
	}
	useEffect(() => {
		if (number === index) {
			const fetchSchema = () => {
				let introspectionQuery = getIntrospectionQuery()
				let staticName = 'IntrospectionQuery'
				let introspectionQueryName = staticName
				let graphQLParams = {
					query: introspectionQuery,
					operationName: introspectionQueryName,
				}
				fetcher(graphQLParams)
				.then(data => data.json())	
				.then(result => {
					if (typeof result !== 'string' && 'data' in result) {
						let schema = buildClientSchema(result.data)
						setSchema(schema)
					}
				}).catch(e => {})
			}
			fetchSchema() 
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [debouncedURL])
	const plugins = useMemo(()=> [JsonPlugin, ...vegaPlugins], [])
	let indexx = plugins.map(plugin => plugin.id).indexOf(currentQuery.widget_id)
	const WidgetComponent = indexx>=0 ? plugins[indexx] : plugins[0]

	return (
		<div 
			className={'graphiql__wrapper ' + 
				(currentTab === tabs[number].id ? 'graphiql__wrapper_active' : '')
				+ (!showGallery ? ' graphiql__wrapper_wide' : '')
			}
			key={number}
		>
			<ToolbarComponent />
			<div className="over-wrapper" onMouseDown={handleResizer} ref={overwrap}>
				<button className="execute-button" ref={executeButton} onClick={getResult} ></button>
				<div className="workspace__wrapper" ref={workspace}>
					<GraphqlEditor 
						schema={schema}
						query={query[number].query}
						number={number}
						variables={query[number].variables}
						variableToType={_variableToType}
						onEditQuery={editQueryHandler}
						onEditVariables={editQueryHandler}
					/>
					<WidgetEditorControls 
						model={queryTypes}
						dataSource={dataSource}
						setDataSource={setDataSource}
						name={WidgetComponent.name}
						setValue={setWidgetType}
						plugins={plugins}
					/>
					{currentQuery.displayed_data ? <WidgetComponent.editor 
						model={dataModel}
						displayedData={toJS(query[index].displayed_data)}
						config={toJS(query[index].config)}
						setConfig={setConfig} 
					/> : <div className="widget" /> }
				</div>
				<div className="widget-display">
					<div className="sizeChanger"/>
					<WidgetComponent.renderer 
						dataSource={dataSource} 
						displayedData={toJS(currentQuery.displayed_data)}
						config={toJS(query[index].config)} 
						el={currentTab === tabs[number].id ? `asd${currentTab}` : ''} 
					/>
				</div>
			</div>
		</div>
	)
})

export default EditorInstance