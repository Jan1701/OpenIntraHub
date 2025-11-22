import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Alert,
} from 'react-native';
import {
  List,
  Divider,
  Surface,
  Avatar,
  Text,
  Switch,
  Button,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';

export default function MoreScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { user, logout } = useAuthStore();

  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(colorScheme === 'dark');

  const handleLogout = () => {
    Alert.alert(
      t('auth.logoutConfirmTitle', 'Logout'),
      t('auth.logoutConfirmMessage', 'Are you sure you want to logout?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('auth.logout', 'Logout'),
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const isDark = colorScheme === 'dark';

  return (
    <ScrollView style={[styles.container, isDark && styles.containerDark]}>
      {/* User Profile Card */}
      <Surface style={styles.profileCard} elevation={1}>
        <Avatar.Text
          size={64}
          label={user?.firstName?.[0] || user?.username?.[0]?.toUpperCase() || 'U'}
          style={styles.avatar}
        />
        <View style={styles.profileInfo}>
          <Text style={styles.userName}>
            {user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : user?.username}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <Text style={styles.userRole}>{user?.role}</Text>
        </View>
      </Surface>

      {/* Main Menu */}
      <Surface style={styles.menuSection} elevation={1}>
        <List.Section>
          <List.Subheader>{t('more.content', 'Content')}</List.Subheader>

          <List.Item
            title={t('nav.posts', 'Posts & News')}
            description={t('more.postsDesc', 'Read company news and updates')}
            left={(props) => <List.Icon {...props} icon="post" color="#3B82F6" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/posts')}
          />
          <Divider />

          <List.Item
            title={t('nav.events', 'Events & Calendar')}
            description={t('more.eventsDesc', 'View upcoming events')}
            left={(props) => <List.Icon {...props} icon="calendar" color="#10B981" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/events')}
          />
          <Divider />

          <List.Item
            title={t('nav.locations', 'Locations')}
            description={t('more.locationsDesc', 'Rooms and meeting spaces')}
            left={(props) => <List.Icon {...props} icon="map-marker" color="#F59E0B" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/locations')}
          />
          <Divider />

          <List.Item
            title={t('nav.mail', 'Mail')}
            description={t('more.mailDesc', 'Access your mailbox')}
            left={(props) => <List.Icon {...props} icon="email" color="#8B5CF6" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/mail')}
          />
        </List.Section>
      </Surface>

      {/* Settings */}
      <Surface style={styles.menuSection} elevation={1}>
        <List.Section>
          <List.Subheader>{t('more.settings', 'Settings')}</List.Subheader>

          <List.Item
            title={t('more.notifications', 'Notifications')}
            description={t('more.notificationsDesc', 'Push notifications')}
            left={(props) => <List.Icon {...props} icon="bell" color="#3B82F6" />}
            right={() => (
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                color="#3B82F6"
              />
            )}
          />
          <Divider />

          <List.Item
            title={t('more.language', 'Language')}
            description={i18n.language.toUpperCase()}
            left={(props) => <List.Icon {...props} icon="translate" color="#10B981" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/settings/language')}
          />
          <Divider />

          <List.Item
            title={t('more.status', 'Status')}
            description={user?.status || 'Available'}
            left={(props) => <List.Icon {...props} icon="account-circle" color="#F59E0B" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/settings/status')}
          />
          <Divider />

          <List.Item
            title={t('more.outOfOffice', 'Out of Office')}
            description={t('more.outOfOfficeDesc', 'Manage OOF settings')}
            left={(props) => <List.Icon {...props} icon="airplane" color="#8B5CF6" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/settings/oof')}
          />
        </List.Section>
      </Surface>

      {/* Account */}
      <Surface style={styles.menuSection} elevation={1}>
        <List.Section>
          <List.Subheader>{t('more.account', 'Account')}</List.Subheader>

          <List.Item
            title={t('more.profile', 'Profile')}
            description={t('more.profileDesc', 'Edit your profile')}
            left={(props) => <List.Icon {...props} icon="account-edit" color="#3B82F6" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/settings/profile')}
          />
          <Divider />

          <List.Item
            title={t('more.security', 'Security')}
            description={t('more.securityDesc', 'Password and security')}
            left={(props) => <List.Icon {...props} icon="shield-lock" color="#10B981" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/settings/security')}
          />
        </List.Section>
      </Surface>

      {/* About & Support */}
      <Surface style={styles.menuSection} elevation={1}>
        <List.Section>
          <List.Subheader>{t('more.about', 'About')}</List.Subheader>

          <List.Item
            title={t('more.help', 'Help & Support')}
            left={(props) => <List.Icon {...props} icon="help-circle" color="#6B7280" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/help')}
          />
          <Divider />

          <List.Item
            title={t('more.privacy', 'Privacy Policy')}
            left={(props) => <List.Icon {...props} icon="shield-check" color="#6B7280" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/privacy')}
          />
          <Divider />

          <List.Item
            title={t('more.version', 'Version')}
            description="0.1.0"
            left={(props) => <List.Icon {...props} icon="information" color="#6B7280" />}
          />
        </List.Section>
      </Surface>

      {/* Logout Button */}
      <View style={styles.logoutContainer}>
        <Button
          mode="outlined"
          onPress={handleLogout}
          icon="logout"
          textColor="#EF4444"
          style={styles.logoutButton}
        >
          {t('auth.logout', 'Logout')}
        </Button>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>OpenIntraHub Mobile</Text>
        <Text style={styles.footerVersion}>v0.1.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  profileCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: '#3B82F6',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  userRole: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  menuSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  logoutContainer: {
    padding: 16,
  },
  logoutButton: {
    borderColor: '#EF4444',
    borderRadius: 12,
  },
  footer: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  footerVersion: {
    fontSize: 12,
    color: '#D1D5DB',
    marginTop: 4,
  },
});
