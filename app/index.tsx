import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { router } from "expo-router";
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import * as XLSX from 'xlsx';


interface Parcelle {
  id: string;
  numeroDeLot: string;
  etatDeParcelle: string;
  nombreDeLogement: string;
  acheve: string;
  enCours: string;
  image: { uri: string; name: string; assetId?: string } | null;
  createdAt: string;
}

const STORAGE_KEY = 'parcelles_data';

export default function Index() {
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Load parcelles when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      loadParcelles();
    }, [])
  );

  const loadParcelles = async () => {
    try {
      setIsLoading(true);
      const storedParcelles = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedParcelles) {
        const parsedParcelles = JSON.parse(storedParcelles);
        // Sort by creation date (newest first)
        const sortedParcelles = parsedParcelles.sort((a: Parcelle, b: Parcelle) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setParcelles(sortedParcelles);
      } else {
        setParcelles([]);
      }
    } catch (error) {
      console.error('Error loading parcelles:', error);
      Alert.alert('Erreur', 'Une erreur s\'est produite lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadParcelles();
    setRefreshing(false);
  };

  const deleteImageFromMediaLibrary = async (assetId?: string) => {
    if (!assetId) return;
    
    try {
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Media library permission not granted');
        return;
      }

      // Delete the asset from media library
      await MediaLibrary.deleteAssetsAsync([assetId]);
      console.log('Image deleted from media library');
    } catch (error) {
      console.error('Error deleting image from media library:', error);
      // Don't show error to user as this is not critical
    }
  };

  const deleteParcelle = async (parcelleId: string, image?: { uri: string; name: string; assetId?: string }) => {
    Alert.alert(
      'Confirmer la suppression',
      'Êtes-vous sûr de vouloir supprimer cette parcelle? Cette action ne peut pas être annulée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(parcelleId);
              
              // Remove parcelle from list
              const updatedParcelles = parcelles.filter(parcelle => parcelle.id !== parcelleId);
              setParcelles(updatedParcelles);
              
              // Update AsyncStorage
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedParcelles));
              
              // Delete image from media library if it has an assetId
              if (image?.assetId) {
                await deleteImageFromMediaLibrary(image.assetId);
              }
              
              Alert.alert('Succès', 'Parcelle supprimée avec succès');
            } catch (error) {
              console.error('Error deleting parcelle:', error);
              Alert.alert('Erreur', 'Une erreur s\'est produite lors de la suppression');
              // Reload parcelles in case of error
              loadParcelles();
            } finally {
              setIsDeleting(null);
            }
          }
        }
      ]
    );
  };

  const deleteAllMediaLibraryImages = async () => {
    try {
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Media library permission not granted');
        return;
      }

      // Get all assetIds from parcelles
      const assetIds = parcelles
        .map(parcelle => parcelle.image?.assetId)
        .filter((assetId): assetId is string => Boolean(assetId));

      if (assetIds.length > 0) {
        await MediaLibrary.deleteAssetsAsync(assetIds);
        console.log(`Deleted ${assetIds.length} images from media library`);
      }
    } catch (error) {
      console.error('Error deleting images from media library:', error);
      // Don't show error to user as this is not critical
    }
  };

  const deleteAllParcelles = async () => {
    Alert.alert(
      'Confirmer la suppression',
      'Êtes-vous sûr de vouloir supprimer toutes les parcelles? Cette action ne peut pas être annulée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer tout',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              // Delete all images from media library
              await deleteAllMediaLibraryImages();
              
              // Clear AsyncStorage
              await AsyncStorage.removeItem(STORAGE_KEY);
              
              setParcelles([]);
              Alert.alert('Succès', 'Toutes les parcelles ont été supprimées');
            } catch (error) {
              console.error('Error deleting all parcelles:', error);
              Alert.alert('Erreur', 'Une erreur s\'est produite lors de la suppression');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportToExcel = async () => {
    if (parcelles.length === 0) {
      Alert.alert('Attention', 'Aucune donnée à exporter');
      return;
    }

    try {
      setIsExporting(true);
      
      // Prepare data for Excel
      const excelData = parcelles.map((parcelle, index) => ({
        'N° Séquentiel': index + 1,
        'N° de Lot': parcelle.numeroDeLot,
        'État de Parcelle': parcelle.etatDeParcelle,
        'Nombre de Logements': parcelle.nombreDeLogement,
        'Étages Achevés': parcelle.acheve || '',
        'Étages en Cours': parcelle.enCours || '',
        'Nom de l\'Image': parcelle.image?.name || 'Aucune image',
        'Contient une Image': parcelle.image ? 'Oui' : 'Non',
        'Photo dans Galerie': parcelle.image?.assetId ? 'Oui' : 'Non',
        'Date d\'Ajout': formatDate(parcelle.createdAt),
        'ID Parcelle': parcelle.id
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 15 }, // N° Séquentiel
        { wch: 12 }, // N° de Lot
        { wch: 18 }, // État de Parcelle
        { wch: 18 }, // Nombre de Logements
        { wch: 15 }, // Étages Achevés
        { wch: 15 }, // Étages en Cours
        { wch: 20 }, // Nom de l'Image
        { wch: 18 }, // Contient une Image
        { wch: 18 }, // Photo dans Galerie
        { wch: 25 }, // Date d'Ajout
        { wch: 20 }  // ID Parcelle
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Liste des Parcelles');

      // Generate Excel file
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      
      // Create filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const fileName = `parcelles_list_${currentDate}.xlsx`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // Write file to device
      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Partager la liste des parcelles',
          UTI: 'com.microsoft.excel.xlsx'
        });
        
        Alert.alert('Succès', `Fichier Excel créé et sauvegardé avec succès\nNom du fichier: ${fileName}`);
      } else {
        Alert.alert('Succès', `Fichier Excel créé et sauvegardé dans:\n${fileUri}`);
      }

    } catch (error) {
      console.error('Error exporting to Excel:', error);
      Alert.alert('Erreur', 'Une erreur s\'est produite lors de la création du fichier Excel');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Chargement des parcelles...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🏗️ Liste des Parcelles</Text>
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>Total: {parcelles.length} parcelle{parcelles.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          onPress={() => router.push("/add-parcelle-form")}
          style={styles.addButton}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonIcon}>➕</Text>
          <Text style={styles.addButtonText}>Ajouter Parcelle</Text>
        </TouchableOpacity>

        {parcelles.length > 0 && (
          <TouchableOpacity
            onPress={exportToExcel}
            style={styles.exportButton}
            activeOpacity={0.8}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={styles.exportButtonIcon}>📊</Text>
                <Text style={styles.exportButtonText}>Export Excel</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Parcelles List */}
      {parcelles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏗️</Text>
          <Text style={styles.emptyTitle}>Aucune parcelle</Text>
          <Text style={styles.emptySubtitle}>Ajoutez votre première parcelle</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {parcelles.map((parcelle) => (
            <View key={parcelle.id} style={styles.parcelleCard}>
              {/* Parcelle Image */}
              {parcelle.image ? (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: parcelle.image.uri }} style={styles.parcelleImage} />
                  {/* Lot Number Badge on Image */}
                  <View style={styles.lotNumberBadge}>
                    <Text style={styles.lotNumberBadgeText}>{parcelle.numeroDeLot}</Text>
                  </View>
                  {/* Gallery Badge */}
                  {parcelle.image.assetId && (
                    <View style={styles.galleryBadge}>
                      <Text style={styles.galleryBadgeText}>📱</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.noImageContainer}>
                  <Text style={styles.noImageIcon}>🏗️</Text>
                  <Text style={styles.noImageText}>Aucune photo</Text>
                  {/* Lot Number Badge on No Image */}
                  <View style={styles.lotNumberBadgeNoImage}>
                    <Text style={styles.lotNumberBadgeText}>{parcelle.numeroDeLot}</Text>
                  </View>
                </View>
              )}

              {/* Parcelle Info */}
              <View style={styles.parcelleInfo}>
                <View style={styles.parcelleHeader}>
                  <Text style={styles.lotNumber}>Lot N° {parcelle.numeroDeLot}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>État:</Text>
                  <Text style={styles.infoValue}>{parcelle.etatDeParcelle}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Logements:</Text>
                  <Text style={styles.infoValue}>{parcelle.nombreDeLogement}</Text>
                </View>

                {parcelle.acheve && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Achevé:</Text>
                    <Text style={[styles.infoValue, styles.completedText]}>{parcelle.acheve}</Text>
                  </View>
                )}

                {parcelle.enCours && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>En cours:</Text>
                    <Text style={[styles.infoValue, styles.inProgressText]}>{parcelle.enCours}</Text>
                  </View>
                )}

                <Text style={styles.dateText}>Ajouté le: {formatDate(parcelle.createdAt)}</Text>

                {/* Delete Button */}
                <TouchableOpacity
                  onPress={() => deleteParcelle(parcelle.id, parcelle.image || undefined)}
                  style={styles.deleteButton}
                  activeOpacity={0.8}
                  disabled={isDeleting === parcelle.id}
                >
                  {isDeleting === parcelle.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.deleteButtonIcon}>🗑️</Text>
                      <Text style={styles.deleteButtonText}>Supprimer</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Delete All Button at Bottom */}
          {parcelles.length > 0 && (
            <View style={styles.bottomActions}>
              <TouchableOpacity
                onPress={deleteAllParcelles}
                style={styles.deleteAllButton}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteAllButtonIcon}>🗑️</Text>
                <Text style={styles.deleteAllButtonText}>Supprimer Toutes les Parcelles</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{height: 100}} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
  },
  statsContainer: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statsText: {
    fontSize: 14,
    color: '#0C4A6E',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 8,
  },
  addButtonIcon: {
    fontSize: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 8,
  },
  exportButtonIcon: {
    fontSize: 16,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  parcelleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
  },
  parcelleImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
  },
  noImageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  noImageIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  noImageText: {
    fontSize: 14,
    color: '#6B7280',
  },
  lotNumberBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  lotNumberBadgeNoImage: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  lotNumberBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  galleryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  galleryBadgeText: {
    fontSize: 12,
  },
  parcelleInfo: {
    padding: 16,
  },
  parcelleHeader: {
    marginBottom: 12,
  },
  lotNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  completedText: {
    color: '#10B981',
  },
  inProgressText: {
    color: '#F59E0B',
  },
  dateText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    marginBottom: 12,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 6,
  },
  deleteButtonIcon: {
    fontSize: 14,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomActions: {
    marginTop: 20,
    marginBottom: 20,
  },
  deleteAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteAllButtonIcon: {
    fontSize: 16,
  },
  deleteAllButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});