import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";

import { colors, fonts } from "@/src/theme";

function TabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView
        intensity={Platform.OS === "android" ? 24 : 40}
        tint="dark"
        experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
        style={StyleSheet.absoluteFill}
      />
      {/* translucent fill so scrolled content never bleeds through harshly */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(13,13,17,0.82)" }]} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.onSurfaceTertiary,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 68,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarBackground: () => <TabBarBackground />,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, marginBottom: 6 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarButtonTestID: "tab-home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "aperture" : "aperture-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarButtonTestID: "tab-history",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "time" : "time-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarButtonTestID: "tab-profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
