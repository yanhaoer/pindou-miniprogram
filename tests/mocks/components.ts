import React from 'react'

export const View: React.FC<any> = ({ children, ...props }) => React.createElement('div', props, children)
export const Text: React.FC<any> = ({ children, ...props }) => React.createElement('span', props, children)
export const Input: React.FC<any> = (props) => React.createElement('input', props)
export const Button: React.FC<any> = ({ children, ...props }) => React.createElement('button', props, children)
export const ScrollView: React.FC<any> = ({ children, ...props }) => React.createElement('div', props, children)
export const Image: React.FC<any> = (props) => React.createElement('img', props)
export const RootPortal: React.FC<any> = ({ children }) => React.createElement(React.Fragment, null, children)

export default {
  View,
  Text,
  Input,
  Button,
  ScrollView,
  Image,
  RootPortal
}
