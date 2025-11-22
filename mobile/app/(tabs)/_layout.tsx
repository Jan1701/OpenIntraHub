import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

type IoniconsName = keyof typeof Ionicons.glyphMap;
type MaterialCommunityIconsName = keyof typeof MaterialCommunityIcons.glyphMap;

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  const tabBarActiveTintColor = '#3B82F6';
  const tabBarInactiveTintColor = colorScheme === 'dark' ? '#9CA3AF' : '#6B7280';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor,
        tabBarInactiveTintColor,
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#1F2937' : '#fff',
          borderTopColor: colorScheme === 'dark' ? '#374151' : '#E5E7EB',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: '#3B82F6',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('nav.dashboard', 'Dashboard'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('nav.chat', 'Chat'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="drive"
        options={{
          title: t('nav.drive', 'Drive'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="folder" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: t('nav.projects', 'Projects'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('nav.more', 'More'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="menu" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
