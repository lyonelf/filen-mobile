import React, { useEffect, useState, memo, useMemo } from "react"
import { View, DeviceEventEmitter, Platform, Alert } from "react-native"
import ActionSheet, { SheetManager } from "react-native-actions-sheet"
import storage from "../../../lib/storage"
import { useMMKVString, useMMKVNumber } from "react-native-mmkv"
import { useSafeAreaInsets, EdgeInsets } from "react-native-safe-area-context"
import { useStore } from "../../../lib/state"
import { queueFileDownload } from "../../../lib/services/download/download"
import { getFileExt, getRouteURL, calcPhotosGridSize } from "../../../lib/helpers"
import { showToast } from "../../Toasts"
import { i18n } from "../../../i18n"
import { StackActions } from "@react-navigation/native"
import { hasStoragePermissions, hasPhotoLibraryPermissions } from "../../../lib/permissions"
import { bulkFavorite, bulkTrash, bulkDeletePermanently, bulkRestore, bulkStopSharing, bulkRemoveSharedIn, emptyTrash } from "../../../lib/api"
import { addToSavedToGallery } from "../../../lib/services/items"
import { removeFromOfflineStorage } from "../../../lib/services/offline"
import { getColor } from "../../../style/colors"
import { navigationAnimation } from "../../../lib/state"
import * as MediaLibrary from "expo-media-library"
import { ActionButton, ActionSheetIndicator } from "../ActionSheets"
import useDarkMode from "../../../lib/hooks/useDarkMode"
import useLang from "../../../lib/hooks/useLang"

export interface TopBarActionSheetProps {
	navigation: any
}

const TopBarActionSheet = memo(({ navigation }: TopBarActionSheetProps) => {
    const darkMode = useDarkMode()
	const insets: EdgeInsets = useSafeAreaInsets()
	const [viewMode, setViewMode] = useMMKVString("viewMode", storage)
	const lang = useLang()
	const currentRoutes = useStore(state => state.currentRoutes)
	const [routeURL, setRouteURL] = useState<string>("")
	const [photosGridSize, setPhotosGridSize] = useMMKVNumber("photosGridSize", storage)
	const [canShowListViewStyle, setCanShowListViewStyle] = useState<boolean>(false)
	const [canShowSelectAllItems, setCanShowSelectAllItems] = useState<boolean>(false)
	const [canShowUnselectAllItems, setCanShowUnselectAllItems] = useState<boolean>(false)
	const [canShowTransfersButton, setCanShowTransfersButton] = useState<boolean>(false)
	const itemsSelectedCount = useStore(state => state.itemsSelectedCount)
	const [canShowBulkItemsActions, setCanShowBulkItemsActions] = useState<boolean>(false)
	const [canShowMoveItems, setCanShowMoveItems] = useState<boolean>(false)
	const currentItems = useStore(state => state.currentItems)
	const [canShowSaveToGallery, setCanShowSaveToGallery] = useState<boolean>(false)
	const [canShowTrash, setCanShowTrash] = useState<boolean>(false)
	const [canShowRemoveOffline, setCanShowRemoveOffline] = useState<boolean>(false)
	const [canShowRemoveFavorite, setCanShowRemoveFavorite] = useState<boolean>(false)
	const setCurrentBulkItems = useStore(state => state.setCurrentBulkItems)
	const [canShowAddFavorite, setCanShowAddFavorite] = useState<boolean>(false)
	const [canShowRemoveSharedIn, setCanShowRemoveSharedIn] = useState<boolean>(false)
	const [canShowStopSharing, setCanShowStopSharing] = useState<boolean>(false)
	const [publicKey, setPublicKey] = useMMKVString("publicKey", storage)
    const [privateKey, setPrivateKey] = useMMKVString("privateKey", storage)
	const [currentRouteName, setCurrentRouteName] = useState<string>("")
	const [canMakeAvailableOffline, setCanMakeAvailableOffline] = useState<boolean>(false)
	const [canDownload, setCanDownload] = useState<boolean>(false)

	const maxBulkActionsItemsCount: number = 10000
	const minBulkActionsItemCount: number = 2

	const viewModeParsed = useMemo(() => {
		if(!viewMode){
			return {}
		}

		return JSON.parse(viewMode)
	}, [viewMode])

	const doesSelectedItemsContainOfflineStoredItems = (): boolean => {
		if(!Array.isArray(currentItems)){
			return false
		}

		return currentItems.filter(item => item.offline && item.selected).length > 0 ? true : false
	}

	const doesSelectedItemsContainFavoritedItems = (): boolean => {
		if(!Array.isArray(currentItems)){
			return false
		}

		return currentItems.filter(item => item.favorited && item.selected).length > 0 ? true : false
	}

	const doesSelectedItemsContainUnmovableItems = (): boolean => {
		if(!Array.isArray(currentItems)){
			return false
		}

		return currentItems.filter(item => (item.isDefault || item.isSync) && item.selected).length > 0 ? true : false
	}

	const doesSelecteditemsContainGallerySaveableItems = (): boolean => {
		if(!Array.isArray(currentItems)){
			return false
		}

		let extArray: any[] = []

		if(Platform.OS == "ios"){
			extArray = ["jpg", "jpeg", "heif", "heic", "png", "gif", "mov", "mp4", "hevc"]
		}
		else{
			extArray = ["jpg", "jpeg", "png", "gif", "mov", "mp4"]
		}

		return currentItems.filter(item => item.selected && extArray.includes(getFileExt(item.name))).length > 0 ? true : false
	}

	const doesSelectedItemsContainFolders = (): boolean => {
		if(!Array.isArray(currentItems)){
			return false
		}

		return currentItems.filter(item => item.type == "folder" && item.selected).length > 0 ? true : false
	}

	const updateBulkItems = (): any[] => {
		const bulkItems: any[] = []

		for(let i = 0; i < currentItems.length; i++){
			if(currentItems[i].selected){
				bulkItems.push(currentItems[i])
			}
		}

		setCurrentBulkItems(bulkItems)

		return bulkItems
	}

	const can = (): void => {
		setCanShowTransfersButton(true)
		setCanShowSelectAllItems(true)
		setCanShowUnselectAllItems(true)
		setCanShowListViewStyle(true)
		setCanShowBulkItemsActions(true)
		setCanShowMoveItems(true)
		setCanShowSaveToGallery(true)
		setCanShowTrash(true)
		setCanShowRemoveOffline(true)
		setCanShowRemoveFavorite(true)
		setCanShowAddFavorite(true)
		setCanShowRemoveSharedIn(true)
		setCanShowStopSharing(true)
		setCanMakeAvailableOffline(true)
		setCanDownload(true)

		if(routeURL.indexOf("photos") !== -1){
			setCanShowListViewStyle(false)
			setCanShowMoveItems(false)

			if(calcPhotosGridSize(photosGridSize) >= 6){
				setCanShowSelectAllItems(false)
				setCanShowUnselectAllItems(false)
			}
		}

		if(routeURL.indexOf("transfers") !== -1){
			setCanShowBulkItemsActions(false)
		}

		if(routeURL.indexOf("settings") !== -1){
			setCanShowBulkItemsActions(false)
		}

		if(doesSelecteditemsContainGallerySaveableItems()){
			setCanShowSaveToGallery(true)
		}
		else{
			setCanShowSaveToGallery(false)
		}

		if(doesSelectedItemsContainOfflineStoredItems()){
			setCanShowRemoveOffline(true)
		}
		else{
			setCanShowRemoveOffline(false)
		}

		if(doesSelectedItemsContainFavoritedItems()){
			setCanShowRemoveFavorite(true)
		}
		else{
			setCanShowRemoveFavorite(false)
		}

		if(doesSelectedItemsContainUnmovableItems()){
			setCanShowMoveItems(false)
		}

		if(routeURL.indexOf("shared-in") !== -1){
			setCanShowTrash(false)
			setCanShowMoveItems(false)
			setCanShowRemoveOffline(false)
			setCanShowRemoveFavorite(false)
			setCanShowAddFavorite(false)
		}

		if(routeURL.indexOf("shared-in") == -1){
			setCanShowRemoveSharedIn(false)
		}

		if(routeURL.indexOf("shared-out") == -1){
			setCanShowStopSharing(false)
		}

		if(doesSelectedItemsContainFolders()){
			setCanDownload(false)
			setCanMakeAvailableOffline(false)
		}
	}

	const updateRouteURL = (): void => {
		if(typeof currentRoutes !== "undefined"){
			if(typeof currentRoutes[currentRoutes.length - 1] !== "undefined"){
				setRouteURL(getRouteURL(currentRoutes[currentRoutes.length - 1]))
				setCurrentRouteName(currentRoutes[currentRoutes.length - 1].name)
			}
		}
	}

	useEffect(() => {
		can()
	}, [photosGridSize])

	useEffect(() => {
		can()
	}, [routeURL])

	useEffect(() => {
		can()
	}, [currentItems])

	useEffect(() => {
		updateRouteURL()
		can()
	}, [currentRoutes])

	useEffect(() => {
		updateRouteURL()
		can()
	}, [])

    return (
		// @ts-ignore
        <ActionSheet
			id="TopBarActionSheet"
			gestureEnabled={true}
			containerStyle={{
				backgroundColor: getColor(darkMode, "backgroundSecondary"),
				borderTopLeftRadius: 15,
				borderTopRightRadius: 15
			}}
			indicatorStyle={{
				display: "none"
			}}
		>
          	<View
				style={{
					paddingBottom: (insets.bottom + 25)
				}}
			>
				<ActionSheetIndicator />
				<View
					style={{
						height: 15
					}}
				/>
				{
					currentRouteName == "TransfersScreen" && (
						<>
							<ActionButton
								onPress={async () => {
									await SheetManager.hide("TopBarActionSheet")
				
									const currentUploads = useStore.getState().uploads
									const currentDownloads = useStore.getState().downloads

									for(let prop in currentUploads){
										currentUploads[prop].stopped = true
									}

									for(let prop in currentDownloads){
										currentDownloads[prop].stopped = true
									}

									useStore.setState({
										uploads: currentUploads,
										downloads: currentDownloads
									})
								}}
								icon="stop-circle-outline"
								text={i18n(lang, "stopAllTransfers")}
							/>
							<ActionButton
								onPress={async () => {
									await SheetManager.hide("TopBarActionSheet")
				
									const currentUploads = useStore.getState().uploads
									const currentDownloads = useStore.getState().downloads

									for(let prop in currentUploads){
										currentUploads[prop].paused = true
									}

									for(let prop in currentDownloads){
										currentDownloads[prop].paused = true
									}

									useStore.setState({
										uploads: currentUploads,
										downloads: currentDownloads
									})
								}}
								icon="pause-circle-outline"
								text={i18n(lang, "pauseAllTransfers")}
							/>
							<ActionButton
								onPress={async () => {
									await SheetManager.hide("TopBarActionSheet")
				
									const currentUploads = useStore.getState().uploads
									const currentDownloads = useStore.getState().downloads

									for(let prop in currentUploads){
										currentUploads[prop].paused = false
									}

									for(let prop in currentDownloads){
										currentDownloads[prop].paused = false
									}

									useStore.setState({
										uploads: currentUploads,
										downloads: currentDownloads
									})
								}}
								icon="play-circle-outline"
								text={i18n(lang, "resumeAllTransfers")}
							/>
						</>
					)
				}
				{
					currentRouteName !== "TransfersScreen" && (
						<>
							{
								routeURL.indexOf("photos") == -1 && routeURL.indexOf("recents") == -1 && currentItems.length > 0 && (
									<ActionButton
										onPress={async () => {
											await SheetManager.hide("TopBarActionSheet")
						
											SheetManager.show("SortByActionSheet")
										}}
										icon="funnel-outline"
										text={i18n(lang, "sortBy")} 
									/>
								)
							}
							{
								canShowSelectAllItems && currentItems.length > 0 && (
									<ActionButton
										onPress={async () => {
											//await SheetManager.hide("TopBarActionSheet")
						
											DeviceEventEmitter.emit("event", {
												type: "select-all-items"
											})
										}}
										icon="add-outline"
										text={i18n(lang, "selectAll")}
									/>
								)
							}
							{
								canShowUnselectAllItems && currentItems.length > 0 && itemsSelectedCount > 0 && (
									<ActionButton
										onPress={async () => {
											await SheetManager.hide("TopBarActionSheet")
						
											DeviceEventEmitter.emit("event", {
												type: "unselect-all-items"
											})
										}}
										icon="remove-outline"
										text={i18n(lang, "unselectAll")}
									/>
								)
							}
							<>
								{
									routeURL.indexOf("trash") !== -1 && itemsSelectedCount >= minBulkActionsItemCount && itemsSelectedCount <= maxBulkActionsItemsCount ? (
										<>
											<ActionButton
												onPress={async () => {
													await SheetManager.hide("TopBarActionSheet")
								
													useStore.setState({ fullscreenLoadingModalVisible: true })

													const items = updateBulkItems()

													bulkRestore({ items }).then(() => {
														useStore.setState({ fullscreenLoadingModalVisible: false })

														//showToast({ message: i18n(lang, "restoreSelectedItemsSuccess", true, ["__COUNT__"], [items.length]) })
													}).catch((err) => {
														console.log(err)

														useStore.setState({ fullscreenLoadingModalVisible: false })

														showToast({ message: err.toString() })
													})
												}}
												icon="refresh-outline"
												text={i18n(lang, "restore")} 
											/>
											<ActionButton
												onPress={async () => {
													await SheetManager.hide("TopBarActionSheet")
								
													Alert.alert(i18n(lang, "deleteSelectedItemsPermanently"), i18n(lang, "deleteSelectedItemsPermanentlyWarning"), [
														{
															text: i18n(lang, "cancel"),
															onPress: () => {
																return false
															},
															style: "cancel"
														},
														{
															text: i18n(lang, "ok"),
															onPress: () => {
																useStore.setState({ fullscreenLoadingModalVisible: true })

																const items = updateBulkItems()

																bulkDeletePermanently({ items }).then(() => {
																	useStore.setState({ fullscreenLoadingModalVisible: false })

																	//showToast({ message: i18n(lang, "deleteSelectedItemsPermanentlySuccess", true, ["__COUNT__"], [items.length]) })
																}).catch((err) => {
																	console.log(err)

																	useStore.setState({ fullscreenLoadingModalVisible: false })

																	showToast({ message: err.toString() })
																})
															},
															style: "default"
														}
													], {
														cancelable: true
													})
												}}
												icon="close-circle-outline"
												text={i18n(lang, "deletePermanently")} 
											/>
										</>
									) : (
										<>
											{
												routeURL.indexOf("recents") == -1 && canShowBulkItemsActions && canShowMoveItems && itemsSelectedCount >= minBulkActionsItemCount && itemsSelectedCount <= maxBulkActionsItemsCount && (
													<ActionButton
														onPress={async () => {
															await SheetManager.hide("TopBarActionSheet")

															updateBulkItems()
										
															showToast({ type: "moveBulk", message: i18n(lang, "moveItems") })
														}}
														icon="move-outline"
														text={i18n(lang, "move")}
													/>
												)
											}
											{
												canShowBulkItemsActions && canShowAddFavorite && itemsSelectedCount >= minBulkActionsItemCount && itemsSelectedCount <= maxBulkActionsItemsCount && (
													<ActionButton
														onPress={async () => {
															await SheetManager.hide("TopBarActionSheet")

															useStore.setState({ fullscreenLoadingModalVisible: true })

															bulkFavorite({ value: 1, items: updateBulkItems() }).then(() => {
																useStore.setState({ fullscreenLoadingModalVisible: false })

																//showToast({ message: i18n(lang, "selectedItemsMarkedAsFavorite") })
															}).catch((err) => {
																console.log(err)

																useStore.setState({ fullscreenLoadingModalVisible: false })

																showToast({ message: err.toString() })
															})
														}}
														icon="heart"
														text={i18n(lang, "favorite")}
													/>
												)
											}
											{
												canShowBulkItemsActions && canShowRemoveFavorite && itemsSelectedCount >= minBulkActionsItemCount && itemsSelectedCount <= maxBulkActionsItemsCount && (
													<ActionButton
														onPress={async () => {
															await SheetManager.hide("TopBarActionSheet")

															useStore.setState({ fullscreenLoadingModalVisible: true })

															bulkFavorite({ value: 0, items: updateBulkItems() }).then(() => {
																useStore.setState({ fullscreenLoadingModalVisible: false })

																//showToast({ message: i18n(lang, "selectedItemsRemovedAsFavorite") })
															}).catch((err) => {
																console.log(err)

																useStore.setState({ fullscreenLoadingModalVisible: false })

																showToast({ message: err.toString() })
															})
														}}
														icon="heart-outline"
														text={i18n(lang, "unfavorite")}
													/>
												)
											}
											{
												canShowBulkItemsActions && canShowSaveToGallery && itemsSelectedCount >= minBulkActionsItemCount && itemsSelectedCount <= maxBulkActionsItemsCount && (
													<ActionButton
														onPress={async () => {
															await SheetManager.hide("TopBarActionSheet")
										
															useStore.setState({ fullscreenLoadingModalVisible: false })

															hasStoragePermissions().then(() => {
																hasPhotoLibraryPermissions().then(async () => {
																	let extArray: any[] = []

																	if(Platform.OS == "ios"){
																		extArray = ["jpg", "jpeg", "heif", "heic", "png", "gif", "mov", "mp4", "hevc"]
																	}
																	else{
																		extArray = ["jpg", "jpeg", "png", "gif", "mov", "mp4"]
																	}

																	updateBulkItems().forEach((item) => {
																		if(extArray.includes(getFileExt(item.name))){
																			queueFileDownload({
																				file: item,
																				saveToGalleryCallback: (path: string) => {
																					MediaLibrary.saveToLibraryAsync(path).then(() => {
																						addToSavedToGallery(item)

																						showToast({ message: i18n(lang, "itemSavedToGallery", true, ["__NAME__"], [item.name]) })
																					}).catch((err) => {
																						console.log(err)
								
																						showToast({ message: err.toString() })
																					})
																				}
																			}).catch((err) => {
																				if(err == "stopped"){
																					return
																				}

																				if(err == "wifiOnly"){
																					return showToast({ message: i18n(lang, "onlyWifiDownloads") })
																				}
					
																				console.error(err)
					
																				showToast({ message: err.toString() })
																			})
																		}
																	})
																}).catch((err) => {
																	console.log(err)

																	showToast({ message: err.toString() })
																})
															}).catch((err) => {
																console.log(err)

																showToast({ message: err.toString() })
															})
														}}
														icon="image-outline"
														text={i18n(lang, "saveToGallery")}
													/>
												)
											}
											{
												canMakeAvailableOffline && routeURL.indexOf("offline") == -1 && canShowBulkItemsActions && itemsSelectedCount >= minBulkActionsItemCount && itemsSelectedCount <= maxBulkActionsItemsCount && (
													<ActionButton
														onPress={async () => {
															await SheetManager.hide("TopBarActionSheet")
										
															hasStoragePermissions().then(() => {
																updateBulkItems().forEach((item) => {
																	if(!item.offline){
																		queueFileDownload({ file: item, storeOffline: true }).catch((err) => {
																			if(err == "stopped"){
																				return
																			}

																			if(err == "wifiOnly"){
																				return showToast({ message: i18n(lang, "onlyWifiDownloads") })
																			}
				
																			console.error(err)
				
																			showToast({ message: err.toString() })
																		})
																	}
																})
															}).catch((err) => {
																console.log(err)

																showToast({ message: err.toString() })
															})
														}}
														icon="save-outline"
														text={i18n(lang, "makeAvailableOffline")}
													/>
												)
											}
											{
												canShowBulkItemsActions && canShowRemoveOffline && itemsSelectedCount >= minBulkActionsItemCount && itemsSelectedCount <= maxBulkActionsItemsCount && (
													<ActionButton
														onPress={async () => {
															await SheetManager.hide("TopBarActionSheet")
										
															hasStoragePermissions().then(() => {
																updateBulkItems().forEach((item) => {
																	if(item.offline){
																		removeFromOfflineStorage({ item }).then(() => {
																			//showToast({ message: i18n(lang, "itemRemovedFromOfflineStorage", true, ["__NAME__"], [item.name]) })
																		}).catch((err) => {
																			console.log(err)
							
																			showToast({ message: err.toString() })
																		})
																	}
																})
															}).catch((err) => {
																console.log(err)

																showToast({ message: err.toString() })
															})
														}}
														icon="close-circle-outline"
														text={i18n(lang, "removeFromOfflineStorage")} 
													/>
												)
											}
											{
												canDownload && canShowBulkItemsActions && itemsSelectedCount >= minBulkActionsItemCount && itemsSelectedCount <= maxBulkActionsItemsCount && (
													<ActionButton
														onPress={async () => {
															await SheetManager.hide("TopBarActionSheet")
										
															hasStoragePermissions().then(() => {
																updateBulkItems().forEach((item) => {
																	queueFileDownload({ file: item }).catch((err) => {
																		if(err == "stopped"){
																			return
																		}
																		
																		if(err == "wifiOnly"){
																			return showToast({ message: i18n(lang, "onlyWifiDownloads") })
																		}
			
																		console.error(err)
			
																		showToast({ message: err.toString() })
																	})
																})
															}).catch((err) => {
																console.log(err)

																showToast({ message: err.toString() })
															})
														}}
														icon="download-outline"
														text={i18n(lang, "download")}
													/>
												)
											}
											{
												canShowBulkItemsActions && canShowTrash && itemsSelectedCount >= minBulkActionsItemCount && itemsSelectedCount <= maxBulkActionsItemsCount && (
													<ActionButton
														onPress={async () => {
															await SheetManager.hide("TopBarActionSheet")

															useStore.setState({ fullscreenLoadingModalVisible: true })

															bulkTrash({ items: updateBulkItems() }).then(() => {
																useStore.setState({ fullscreenLoadingModalVisible: false })

																DeviceEventEmitter.emit("event", {
																	type: "unselect-all-items"
																})

																//showToast({ message: i18n(lang, "selectedItemsTrashed") })
															}).catch((err) => {
																console.log(err)

																useStore.setState({ fullscreenLoadingModalVisible: false })

																showToast({ message: err.toString() })
															})
														}}
														icon="trash-outline"
														text={i18n(lang, "trash")} 
													/>
												)
											}
											{
												canShowBulkItemsActions && canShowStopSharing && itemsSelectedCount >= minBulkActionsItemCount && itemsSelectedCount <= maxBulkActionsItemsCount && (
													<ActionButton
														onPress={async () => {
															await SheetManager.hide("TopBarActionSheet")

															const items = updateBulkItems()

															Alert.alert(i18n(lang, "stopSharing"), i18n(lang, "bulkStopSharingWarning", true, ["__COUNT__"], [items.length]), [
																{
																	text: i18n(lang, "cancel"),
																	onPress: () => {
																		return false
																	},
																	style: "cancel"
																},
																{
																	text: i18n(lang, "ok"),
																	onPress: () => {
																		useStore.setState({ fullscreenLoadingModalVisible: true })

																		bulkStopSharing({ items }).then(() => {
																			useStore.setState({ fullscreenLoadingModalVisible: false })

																			DeviceEventEmitter.emit("event", {
																				type: "unselect-all-items"
																			})

																			//showToast({ message: i18n(lang, "stoppedSharingSelectedItems", true, ["__COUNT__"], [items.length]) })
																		}).catch((err) => {
																			console.log(err)

																			useStore.setState({ fullscreenLoadingModalVisible: false })

																			showToast({ message: err.toString() })
																		})
																	},
																	style: "default"
																}
															], {
																cancelable: true
															})
														}}
														icon="close-circle-outline"
														text={i18n(lang, "stopSharing")}
													/>
												)
											}
											{
												canShowBulkItemsActions && canShowRemoveSharedIn && itemsSelectedCount >= minBulkActionsItemCount && itemsSelectedCount <= maxBulkActionsItemsCount && (
													<ActionButton
														onPress={async () => {
															await SheetManager.hide("TopBarActionSheet")

															const items = updateBulkItems()

															Alert.alert(i18n(lang, "stopSharing"), i18n(lang, "bulkRemoveSharedInWarning", true, ["__COUNT__"], [items.length]), [
																{
																	text: i18n(lang, "cancel"),
																	onPress: () => {
																		return false
																	},
																	style: "cancel"
																},
																{
																	text: i18n(lang, "ok"),
																	onPress: () => {
																		useStore.setState({ fullscreenLoadingModalVisible: true })

																		bulkRemoveSharedIn({ items }).then(() => {
																			useStore.setState({ fullscreenLoadingModalVisible: false })

																			DeviceEventEmitter.emit("event", {
																				type: "unselect-all-items"
																			})

																			//showToast({ message: i18n(lang, "bulkRemoveSharedInSuccess", true, ["__COUNT__"], [items.length]) })
																		}).catch((err) => {
																			console.log(err)

																			useStore.setState({ fullscreenLoadingModalVisible: false })

																			showToast({ message: err.toString() })
																		})
																	},
																	style: "default"
																}
															], {
																cancelable: true
															})
														}}
														icon="close-circle-outline"
														text={i18n(lang, "remove")}
													/>
												)
											}
										</>
									)
								}
							</>
							{
								canShowListViewStyle && (
									<ActionButton
										onPress={async () => {
											await SheetManager.hide("TopBarActionSheet")

											const routeURL = getRouteURL()

											setViewMode(JSON.stringify({
												...viewModeParsed,
												[routeURL]: viewModeParsed[routeURL] !== "grid" ? "grid" : "list"
											}))
										}}
										icon={viewModeParsed[routeURL] !== "grid" ? "grid-outline" : "list-outline"}
										text={viewModeParsed[routeURL] !== "grid" ? i18n(lang, "gridView") : i18n(lang, "listView")}
									/>
								)
							}
							{
								canShowTransfersButton && (
									<ActionButton 
										onPress={async () => {
											await SheetManager.hide("TopBarActionSheet")
						
											navigationAnimation({ enable: true }).then(() => {
												navigation.current.dispatch(StackActions.push("TransfersScreen"))
											})
										}}
										icon="repeat-outline"
										text={i18n(lang, "transfers")}
									/>
								)
							}
							{
								routeURL.indexOf("trash") !== -1 && currentItems.length > 0 && (
									<ActionButton
										onPress={async () => {
											await SheetManager.hide("TopBarActionSheet")

											Alert.alert(i18n(lang, "emptyTrash"), i18n(lang, "emptyTrashWarning"), [
												{
													text: i18n(lang, "cancel"),
													onPress: () => {
														return false
													},
													style: "cancel"
												},
												{
													text: i18n(lang, "ok"),
													onPress: () => {
														Alert.alert(i18n(lang, "emptyTrash"), i18n(lang, "areYouReallySure"), [
															{
																text: i18n(lang, "cancel"),
																onPress: () => {
																	return false
																},
																style: "cancel"
															},
															{
																text: i18n(lang, "ok"),
																onPress: () => {
																	useStore.setState({ fullscreenLoadingModalVisible: true })
						
																	emptyTrash().then(() => {
																		currentItems.map((item) => {
																			DeviceEventEmitter.emit("event", {
																				type: "remove-item",
																				data: {
																					uuid: item.uuid
																				}
																			})
																		})

																		useStore.setState({ fullscreenLoadingModalVisible: false })
																	}).catch((err) => {
																		console.log(err)

																		useStore.setState({ fullscreenLoadingModalVisible: false })

																		showToast({ message: err.toString() })
																	})
																},
																style: "default"
															}
														], {
															cancelable: true
														})
													},
													style: "default"
												}
											], {
												cancelable: true
											})
										}}
										icon="trash-outline"
										text={i18n(lang, "emptyTrash")}
									/>
								)
							}
						</>
					)
				}
          	</View>
        </ActionSheet>
    )
})

export default TopBarActionSheet