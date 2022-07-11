import { observer } from 'mobx-react-lite'
import React, { useEffect, useState } from 'react'
import { useCallback } from 'react'
import { useHistory, useRouteMatch, useParams } from 'react-router-dom'
import { getQuery, getWidget, getTransferedQuery } from '../api/api'
import {TabsStore, QueriesStore, UserStore} from '../store/queriesStore'
import handleState from '../utils/handleState'
import useEventListener from '../utils/useEventListener'
import logo from '../assets/images/bitquery_logo_w.png'
import GraphqlIcon from './icons/GraphqlIcon'
import { GalleryStore } from '../store/galleryStore'

const TabsComponent = observer(() => {
	const history = useHistory()
	const { queriesListIsOpen, toggleQueriesList } = GalleryStore
	const { user } = UserStore
	const { tabs, currentTab, switchTab, index } = TabsStore
	const match = useRouteMatch(`${process.env.REACT_APP_IDE_URL}/:queryurl`)
	const { setQuery, removeQuery, query, updateQuery, currentQuery, isLoaded, setIsLoaded, setQueryIsTransfered } = QueriesStore
	const [editTabName, setEditTabName] = useState(false)
	const [queryName, setQueryName] = useState({[currentTab]: currentQuery.name})
	const [x,setx] = useState(0)

	useEffect(() => {
		x <=1 && setx(x => x + 1)
		if (x > 1) {
			currentQuery.url
				? history.push(`${process.env.REACT_APP_IDE_URL}/${currentQuery.url}`) 
				: history.push(`${process.env.REACT_APP_IDE_URL}`)
		}
		// eslint-disable-next-line 
	}, [currentQuery.url])
	useEffect(() => {
		if (/^\/ide\/transfer\/[0-9a-fA-F]{6}$/.test(history.location.pathname)) {
			const code = history.location.pathname.match(/[0-9a-fA-F]{6}/)[0]
			const gtf = async () => {
				const { data } = await getTransferedQuery(code)	
				updateQuery({query: data.transferedQuery.query, variables: data.transferedQuery.variables}, index)
				setQueryIsTransfered(true)
				setx(2)
				setIsLoaded()
			}
			gtf()
		} else if (!match) {
			setx(2)
			setIsLoaded()
		} else {
			async function updateTabs() {
				const { data } = await getWidget(match.params.queryurl)
				if (typeof data === 'object') {
					if (query.map(query=>query.id).indexOf(data.id) === -1) {
						updateQuery({...data, config: JSON.parse(data.config), javascript: JSON.parse(data.javascript),  saved: true}, index, data.id)
						setQueryName({[currentTab]: data.name})
						setIsLoaded()
					}
				} else {
					const { data } = await getQuery(match.params.queryurl)
					if (typeof data === 'object') {
						if (query.map(query=>query.id).indexOf(data.id) === -1) {
							updateQuery({...data, config: JSON.parse(data.config), saved: true}, index, data.id)
							setQueryName({[currentTab]: data.name})
							setIsLoaded()
						}
					} 
				}
			}
			updateTabs()
		}
		// eslint-disable-next-line 
	}, [])
	const editTabNameHandler = useCallback(({key}) => {
		if (key==='Enter') {
			setEditTabName(prev=>prev?!prev:prev)
			updateIfNeeded()
		} else if (key==='Escape') {
			setEditTabName(prev=>prev?!prev:prev)
			setQueryName({[currentTab]: tabs[index].name})
		}
		// eslint-disable-next-line 
	}, [setEditTabName, currentTab, queryName])
	useEventListener('keyup', editTabNameHandler)	
	useEffect(() => {
		setEditTabName(false)
		setQueryName(handleState({...queryName}) || {[currentTab]: 'New Query'})
		// eslint-disable-next-line 
	}, [tabs.length])
	const handleEdit = e => setQueryName({...queryName, [currentTab]: e.target.value})
	const switchTabHandler = (tabid) => {
		queriesListIsOpen && toggleQueriesList()
		switchTab(tabid)
		let id = tabs.map(tab => tab.id).indexOf(tabid)
		query[id].url ? history.push(`${process.env.REACT_APP_IDE_URL}/${query[id].url}`) : history.push(`${process.env.REACT_APP_IDE_URL}`)
		setEditTabName(false)
	}
	const addNewTabHandler = () => {
		queriesListIsOpen && toggleQueriesList()
		setQuery({query: '', variables: '{}', name: 'New Query', endpoint_url: currentQuery.endpoint_url, config: '{}'})
	}
	const removeTabHandler = (index, event) => {
		event.stopPropagation()
		tabs.length > 1 && removeQuery(index)
	}
	const updateIfNeeded = () => {
		if (editTabName && queryName[currentTab] && queryName[currentTab].length) {
			let newID = currentQuery.account_id === user?.id ? currentQuery.id : null
			queryName[currentTab]!==query[index].name && updateQuery({name: queryName[currentTab]}, index, newID)
		}
	}
	const renameQueryHandler = () => {
		if (!!currentQuery?.url && !!currentQuery.id) {		//if query READONLY
		} else {
			setEditTabName((prev)=>!prev)
			updateIfNeeded()
		}
	}

	return isLoaded ? (
		<div className="tabs">
			<ul className="nav nav-tabs" >
				<a href="https://bitquery.io" className="topBar__logo">
					<img 
						className="topBar__logo__img" 
						src={logo}
						alt="logo"
					/>
				</a>
				{
					tabs.map((tab, i) => (
						<li 
							className="nav-item" key={i}
							onClick={() => currentTab !== tab.id && switchTabHandler(tab.id)}
						>
							<a href="# " className={'nav-link '+(currentTab === tab.id && 'active')} key={i}>
								{query[i].layout ? <i className="fas fa-th"></i> 
								: query[i].widget_id==='json.widget' || !query[i].widget_id 
								? <GraphqlIcon fill={'#000000'} width={'16px'} height={'16px'}/>
								: <i className="fas fa-chart-bar"></i>}
								{
								(editTabName && currentTab === tab.id) 
									? 	<>
											<input type="text" 
												value={queryName ? queryName[currentTab] : 'New Query'} 
												className="tabs__edit"
												onChange={handleEdit}
											/>
											<i className="fas fa-check" onClick={renameQueryHandler}/>
										</>
									: 	<span className={'nav-link-title ' + ((currentTab === tab.id && !(!!currentQuery?.url && !!currentQuery.id)) ? 'cursor-edit' : undefined)}
											onClick={()=>(currentTab === tab.id && (!currentQuery.id || currentQuery.account_id === user.id)) && renameQueryHandler(currentTab, i)}
										>
											{(('saved' in query[i]) && query[i].saved) || !('saved' in query[i]) 
											? tab.name : `*${tab.name}`}
										</span>
								}
								<i className="tab__close fas fa-times" onClick={e=>removeTabHandler(i, e)} />
							</a>
						</li>
					))
				}
				<li 
					className="nav-item"
					onClick={addNewTabHandler}
				><a href="# " className="nav-link nav-link-add"><i className="tab__add fas fa-plus"/></a></li>
			</ul>
		</div>
	) : <div className="tabs">
		<ul className="nav nav-tabs" >
				<a href="https://bitquery.io" className="topBar__logo">
					<img 
						className="topBar__logo__img" 
						src={logo}
						alt="logo"
					/>
				</a>
			</ul>
	</div>
})

export default TabsComponent
