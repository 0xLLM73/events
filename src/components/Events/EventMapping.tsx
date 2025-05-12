import React, { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../contexts/AuthContext';

interface FormField {
  name: string;
  id?: string;
  type: string;
  label: string;
  placeholder?: string;
  options?: { value: string; text: string }[];
  selector: string;
}

interface FormSchema {
  id: string;
  action?: string;
  method?: string;
  fields: FormField[];
}

interface EventSchema {
  forms: FormSchema[];
  discoveredAt: any;
  sourceUrl: string;
}

interface EventMapping {
  [key: string]: string;
}

interface EventMappingProps {
  eventId: string;
  onMappingComplete?: () => void;
}

const EventMapping: React.FC<EventMappingProps> = ({ eventId, onMappingComplete }) => {
  const { currentUser } = useAuth();
  const [schema, setSchema] = useState<EventSchema | null>(null);
  const [mapping, setMapping] = useState<EventMapping>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSchema = async () => {
      if (!currentUser) return;

      try {
        const db = getFirestore();
        const schemaRef = doc(db, `users/${currentUser.uid}/events/${eventId}/schema/formSchema`);
        const schemaDoc = await getDoc(schemaRef);

        if (!schemaDoc.exists()) {
          throw new Error('No schema found for this event');
        }

        setSchema(schemaDoc.data() as EventSchema);

        // Try to load existing mapping
        const mappingRef = doc(db, `users/${currentUser.uid}/mappings/${eventId}`);
        const mappingDoc = await getDoc(mappingRef);
        
        if (mappingDoc.exists()) {
          setMapping(mappingDoc.data() as EventMapping);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load schema');
      } finally {
        setLoading(false);
      }
    };

    loadSchema();
  }, [currentUser, eventId]);

  const handleFieldMapping = (fieldName: string, value: string) => {
    setMapping(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleSaveMapping = async () => {
    if (!currentUser || !schema) return;

    setSaving(true);
    try {
      const db = getFirestore();
      const mappingRef = doc(db, `users/${currentUser.uid}/mappings/${eventId}`);
      await setDoc(mappingRef, mapping);

      // Update event status to mapped
      const eventRef = doc(db, `users/${currentUser.uid}/events/${eventId}`);
      await setDoc(eventRef, { status: 'mapped', statusReason: 'Ready for signup' }, { merge: true });

      // Trigger signup process
      const functions = getFunctions();
      const enqueueSignup = httpsCallable(functions, 'enqueueSignupTasksV2');
      await enqueueSignup({});

      onMappingComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save mapping');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading schema...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!schema) return <div>No schema available</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Map Form Fields</h2>
      <div className="space-y-4">
        {schema.forms.map((form, formIndex) => (
          <div key={form.id} className="border p-4 rounded">
            <h3 className="font-semibold mb-2">Form {formIndex + 1}</h3>
            {form.fields.map((field) => {
              const fieldKey = field.name || field.label.replace(/\s+/g, '');
              return (
                <div key={field.id || field.name} className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    {field.label || field.name}
                    <span className="text-gray-500 text-xs ml-2">({field.type})</span>
                  </label>
                  <select
                    className="w-full p-2 border rounded"
                    value={mapping[fieldKey] || ''}
                    onChange={(e) => handleFieldMapping(fieldKey, e.target.value)}
                  >
                    <option value="">Select a value</option>
                    <option value="firstName">First Name</option>
                    <option value="lastName">Last Name</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="company">Company</option>
                    <option value="title">Title</option>
                    <option value="custom">Custom Value</option>
                  </select>
                  {mapping[fieldKey] === 'custom' && (
                    <input
                      type="text"
                      className="mt-2 w-full p-2 border rounded"
                      placeholder="Enter custom value"
                      onChange={(e) => handleFieldMapping(fieldKey, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-4">
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          onClick={handleSaveMapping}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Mapping'}
        </button>
      </div>
    </div>
  );
};

export default EventMapping;
