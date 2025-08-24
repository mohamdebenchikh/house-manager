import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { width } = Dimensions.get('window');


interface Parcelle {
  id: string;
  numeroDeLot: string;
  etatDeParcelle: string;
  nombreDeLogement: string;
  acheve:string;
  enCours:string;
  image: { uri: string; name: string } | null;
  createdAt: string;
}

interface AddParcelleFormProps {
  onSave?: (parcelle: Parcelle) => void;
}

const STORAGE_KEY = 'parcelles_data';
const IMAGES_DIRECTORY = `${FileSystem.documentDirectory}parcelle_images/`;


export default function AddParcelleForm({ onSave }: AddParcelleFormProps = {}) {
  const [numeroDeLot, setNumeroDeLot] = useState<string>('');
  const [etatDeParcelle, setEtatDeParcelle] = useState<string>('');
  const [nombreDeLogement, setNombreDeLogement] = useState<string>('');
  const [image, setImage] = useState<{ uri: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [acheve, setAcheve] = useState<string>('');
  const [enCours, setEnCours] = useState<string>('');

  const [errors, setErrors] = useState<{
    numeroDeLot?: string;
    etatDeParcelle?: string;
    nombreDeLogement?: string;
    acheve?: string;
    enCours?: string;
  }>({});

  useEffect(() => {
    initializeStorage();
    loadParcelles();
  }, []);

  const initializeStorage = async () => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(IMAGES_DIRECTORY);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(IMAGES_DIRECTORY, { intermediates: true });
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du stockage:', error);
    }
  };

  const loadParcelles = async () => {
    try {
      const storedParcelles = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedParcelles) {
        setParcelles(JSON.parse(storedParcelles));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des parcelles:', error);
    }
  };

  const saveParcellesToStorage = async (parcellesData: Parcelle[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(parcellesData));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des parcelles:', error);
      throw error;
    }
  };

  const saveImageToFileSystem = async (imageUri: string, imageName: string): Promise<string> => {
    try {
      const fileName = `${Date.now()}_${imageName}`;
      const newPath = `${IMAGES_DIRECTORY}${fileName}`;

      await FileSystem.copyAsync({
        from: imageUri,
        to: newPath,
      });

      return newPath;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'image:', error);
      throw error;
    }
  };

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!numeroDeLot.trim()) {
      newErrors.numeroDeLot = 'N° de lot requis';
    } else {
      const existingParcelle = parcelles.find(p => p.numeroDeLot === numeroDeLot.trim());
      if (existingParcelle) {
        newErrors.numeroDeLot = 'Ce numéro de lot existe déjà';
      }
    }

    if (!etatDeParcelle.trim()) {
      newErrors.etatDeParcelle = 'État de parcelle requis';
    }

    if (!nombreDeLogement.trim()) {
      newErrors.nombreDeLogement = 'Nombre de logements requis';
    } else if (isNaN(Number(nombreDeLogement)) || Number(nombreDeLogement) <= 0) {
      newErrors.nombreDeLogement = 'Doit être un nombre positif';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };



  const pickImage = async () => {
    try {
      setIsLoading(true);
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Attention', 'Veuillez autoriser l\'accès à l\'appareil photo');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage({
          uri: result.assets[0].uri,
          name: `parcelle_${numeroDeLot || Date.now()}.jpg`
        });
      }
    } catch (error) {
      console.log(error)
      Alert.alert('Erreur', 'Une erreur s\'est produite lors de la prise de photo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsSaving(true);

      let savedImagePath = null;

      if (image) {
        savedImagePath = await saveImageToFileSystem(image.uri, image.name);
      }

      const newParcelle: Parcelle = {
        id: Date.now().toString(),
        numeroDeLot: numeroDeLot.trim(),
        etatDeParcelle: etatDeParcelle.trim(),
        nombreDeLogement: nombreDeLogement.trim(),
        acheve: acheve.trim() || '',
        enCours: enCours.trim() || '',
        image: savedImagePath ? { uri: savedImagePath, name: image?.name || '' } : null,
        createdAt: new Date().toISOString(),
      };

      const updatedParcelles = [...parcelles, newParcelle];
      setParcelles(updatedParcelles);

      await saveParcellesToStorage(updatedParcelles);

      if (onSave) {
        onSave(newParcelle);
      }

      // Reset form
      setNumeroDeLot('');
      setEtatDeParcelle('');
      setNombreDeLogement('');
      setAcheve('');
      setEnCours('');
      setImage(null);
      setErrors({});

      router.back();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la parcelle:', error);
      Alert.alert('Erreur', 'Une erreur s\'est produite lors de la sauvegarde des données');
    } finally {
      setIsSaving(false);
    }
  };

  const renderImageWithBadge = () => {
    if (!image) return null;

    return (
      <View style={styles.imagePreviewContainer}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: image.uri }} style={styles.imagePreview} />
          {numeroDeLot.trim() && (
            <View style={styles.numeroLotBadge}>
              <Text style={styles.numeroLotBadgeText}>{numeroDeLot.trim()}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setImage(null)}
          style={styles.removeImageButton}
          activeOpacity={0.8}
        >
          <Text style={styles.removeImageText}>✕ Supprimer le image</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>🏗️ Ajouter une Nouvelle Parcelle</Text>
        <Text style={styles.subtitle}>Remplissez les informations ci-dessous pour ajouter une parcelle</Text>
      </View>

      <View style={styles.form}>
        {/* Numéro de Lot */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>N° de Lot *</Text>
          <TextInput
            value={numeroDeLot}
            onChangeText={(text) => {
              setNumeroDeLot(text);
              if (errors.numeroDeLot) {
                setErrors(prev => ({ ...prev, numeroDeLot: undefined }));
              }
            }}
            placeholder="Entrez le numéro de lot"
            placeholderTextColor="#9CA3AF"
            style={[
              styles.input,
              errors.numeroDeLot && styles.inputError
            ]}
          />
          {errors.numeroDeLot && (
            <Text style={styles.errorText}>{errors.numeroDeLot}</Text>
          )}
        </View>

        {/* État de Parcelle */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>État de Parcelle *</Text>
          <TextInput
            value={etatDeParcelle}
            onChangeText={(text) => {
              setEtatDeParcelle(text);
              if (errors.etatDeParcelle) {
                setErrors(prev => ({ ...prev, etatDeParcelle: undefined }));
              }
            }}
            placeholder="Entrez l'état de la parcelle"
            placeholderTextColor="#9CA3AF"
            style={[
              styles.input,
              errors.etatDeParcelle && styles.inputError
            ]}
          />
          {errors.etatDeParcelle && (
            <Text style={styles.errorText}>{errors.etatDeParcelle}</Text>
          )}
        </View>

        {/* Nombre de Logements */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre de Logements *</Text>
          <TextInput
            value={nombreDeLogement}
            onChangeText={(text) => {
              setNombreDeLogement(text);
              if (errors.nombreDeLogement) {
                setErrors(prev => ({ ...prev, nombreDeLogement: undefined }));
              }
            }}
            placeholder="Entrez le nombre de logements"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            style={[
              styles.input,
              errors.nombreDeLogement && styles.inputError
            ]}
          />
          {errors.nombreDeLogement && (
            <Text style={styles.errorText}>{errors.nombreDeLogement}</Text>
          )}
        </View>

        {/* Achevé */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Étages Achevés</Text>
          <TextInput
            value={acheve}
            onChangeText={(text) => {
              setAcheve(text);
              if (errors.acheve) {
                setErrors(prev => ({ ...prev, acheve: undefined }));
              }
            }}
            placeholder="Ex: R, R+1, R+2..."
            placeholderTextColor="#9CA3AF"
            style={[
              styles.input,
              errors.acheve && styles.inputError
            ]}
          />
          {errors.acheve && (
            <Text style={styles.errorText}>{errors.acheve}</Text>
          )}
        </View>

        {/* En Cours */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Étages en Cours</Text>
          <TextInput
            value={enCours}
            onChangeText={(text) => {
              setEnCours(text);
              if (errors.enCours) {
                setErrors(prev => ({ ...prev, enCours: undefined }));
              }
            }}
            placeholder="Ex: R+3, R+4..."
            placeholderTextColor="#9CA3AF"
            style={[
              styles.input,
              errors.enCours && styles.inputError
            ]}
          />
          {errors.enCours && (
            <Text style={styles.errorText}>{errors.enCours}</Text>
          )}
        </View>

        {/* Construction Status Summary */}
        {(acheve.trim() || enCours.trim()) && (
          <View style={styles.progressSummary}>
            <Text style={styles.progressTitle}>🏗️ État de Construction</Text>
            {acheve.trim() && (
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Étages achevés: </Text>
                <Text style={[styles.progressValue, styles.progressCompleted]}>{acheve}</Text>
              </View>
            )}
            {enCours.trim() && (
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Étages en cours: </Text>
                <Text style={[styles.progressValue, styles.progressInProgress]}>{enCours}</Text>
              </View>
            )}
            {nombreDeLogement.trim() && (
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Total logements: </Text>
                <Text style={styles.progressValue}>{nombreDeLogement}</Text>
              </View>
            )}
          </View>
        )}

        {/* Image Picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Photo de la Parcelle</Text>
          <TouchableOpacity
            onPress={pickImage}
            style={styles.imagePickerButton}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.imagePickerIcon}>📷</Text>
                <Text style={styles.imagePickerText}>
                  {image ? 'Changer la photo' : 'Prendre une photo'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Image Preview with Badge */}
        {renderImageWithBadge()}

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          style={[
            styles.saveButton,
            (isSaving || isLoading) && styles.saveButtonDisabled
          ]}
          activeOpacity={0.8}
          disabled={isSaving || isLoading}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.saveButtonIcon}>💾</Text>
              <Text style={styles.saveButtonText}>Sauvegarder</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      <View style={{ height: 50 }}></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  header: {
    marginBottom: 32,
    marginTop: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 4,
  },
  // Progress Summary Styles
  progressSummary: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  progressCompleted: {
    color: '#10B981',
  },
  progressInProgress: {
    color: '#F59E0B',
  },
  progressRemaining: {
    color: '#6B7280',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  stateButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  stateButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#2563EB',
  },
  stateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  stateButtonTextActive: {
    color: '#fff',
  },
  // Étages Styles
  etagesSectionHeader: {
    marginBottom: 16,
  },
  addEtagesScroll: {
    marginTop: 8,
  },
  addEtageButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  addEtageButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  etageCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  etageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  etageName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  removeEtageButton: {
    backgroundColor: '#EF4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeEtageButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  etageEtatGroup: {
    marginBottom: 8,
  },
  etageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  // Image Styles
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    gap: 8,
  },
  imagePickerIcon: {
    fontSize: 20,
  },
  imagePickerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  imagePreview: {
    width: width - 88,
    height: (width - 88) * 0.6,
    borderRadius: 12,
  },
  numeroLotBadge: {
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
  numeroLotBadgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  removeImageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#EF4444',
    borderRadius: 8,
  },
  removeImageText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: '#10B981',
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonIcon: {
    fontSize: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});